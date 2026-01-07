/**
 * @fileoverview GitPlumbing - The primary domain service for Git plumbing operations
 */

import path from 'node:path';
import fs from 'node:fs';
import { RunnerOptionsSchema, DEFAULT_MAX_BUFFER_SIZE } from './src/ports/RunnerOptionsSchema.js';
import GitSha from './src/domain/value-objects/GitSha.js';
import GitPlumbingError from './src/domain/errors/GitPlumbingError.js';
import InvalidArgumentError from './src/domain/errors/InvalidArgumentError.js';
import CommandRetryPolicy from './src/domain/value-objects/CommandRetryPolicy.js';
import CommandSanitizer from './src/domain/services/CommandSanitizer.js';
import GitStream from './src/infrastructure/GitStream.js';
import ShellRunnerFactory from './src/infrastructure/factories/ShellRunnerFactory.js';
import GitRepositoryService from './src/domain/services/GitRepositoryService.js';
import ExecutionOrchestrator from './src/domain/services/ExecutionOrchestrator.js';
import GitCommandBuilder from './src/domain/services/GitCommandBuilder.js';
import GitBlob from './src/domain/entities/GitBlob.js';
import GitTree from './src/domain/entities/GitTree.js';
import GitTreeEntry from './src/domain/entities/GitTreeEntry.js';
import GitCommit from './src/domain/entities/GitCommit.js';

export { GitCommandBuilder };

/**
 * GitPlumbing provides a low-level, robust interface for executing Git plumbing commands.
 * Adheres to Hexagonal Architecture by defining its dependencies via ports (CommandRunner).
 */
export default class GitPlumbing {
  /**
   * @param {Object} options
   * @param {import('./src/ports/CommandRunnerPort.js').CommandRunner} options.runner - The functional port for shell execution.
   * @param {string} [options.cwd=process.cwd()] - The working directory for git operations.
   * @param {CommandSanitizer} [options.sanitizer] - Injected sanitizer.
   * @param {ExecutionOrchestrator} [options.orchestrator] - Injected orchestrator.
   */
  constructor({ 
    runner, 
    cwd = process.cwd(),
    sanitizer = new CommandSanitizer(),
    orchestrator = new ExecutionOrchestrator()
  }) {
    if (typeof runner !== 'function') {
      throw new InvalidArgumentError('A functional runner port is required for GitPlumbing', 'GitPlumbing.constructor');
    }
    
    // Validate CWD
    const resolvedCwd = path.resolve(cwd);
    if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
      throw new InvalidArgumentError(`Invalid working directory: ${cwd}`, 'GitPlumbing.constructor', { cwd });
    }

    /** @private */
    this.runner = runner;
    /** @private */
    this.cwd = resolvedCwd;
    /** @private */
    this.sanitizer = sanitizer;
    /** @private */
    this.orchestrator = orchestrator;
    /** @private */
    this.repo = new GitRepositoryService({ plumbing: this });
  }

  /**
   * Orchestrates a full commit sequence from content to reference update.
   * @param {Object} options
   * @param {string} options.branch - The reference to update (e.g., 'refs/heads/main')
   * @param {string} options.message - Commit message
   * @param {import('./src/domain/value-objects/GitSignature.js').default} options.author
   * @param {import('./src/domain/value-objects/GitSignature.js').default} options.committer
   * @param {import('./src/domain/value-objects/GitSha.js').default[]} options.parents
   * @param {Array<{path: string, content: string|Uint8Array, mode: string}>} options.files
   * @returns {Promise<GitSha>} The resulting commit SHA.
   */
  async commit({ branch, message, author, committer, parents, files }) {
    // 1. Write Blobs
    const entries = await Promise.all(files.map(async (file) => {
      const blob = GitBlob.fromContent(file.content);
      const sha = await this.repo.writeBlob(blob);
      return new GitTreeEntry({
        path: file.path,
        sha,
        mode: file.mode || '100644'
      });
    }));

    // 2. Write Tree
    const tree = new GitTree(null, entries);
    const treeSha = await this.repo.writeTree(tree);

    // 3. Write Commit
    const commit = new GitCommit({
      sha: null,
      treeSha,
      parents,
      author,
      committer,
      message
    });
    const commitSha = await this.repo.writeCommit(commit);

    // 4. Update Reference
    await this.repo.updateRef({ ref: branch, newSha: commitSha });

    return commitSha;
  }

  /**
   * Factory method to create an instance with the default shell runner for the current environment.
   * @param {Object} [options]
   * @param {string} [options.cwd]
   * @param {string} [options.env] - Override environment detection.
   * @param {CommandSanitizer} [options.sanitizer]
   * @param {ExecutionOrchestrator} [options.orchestrator]
   * @returns {GitPlumbing}
   */
  static createDefault(options = {}) {
    const env = options.env || globalThis.process?.env?.GIT_PLUMBING_ENV;
    return new GitPlumbing({
      runner: ShellRunnerFactory.create({ env }),
      ...options
    });
  }

  /**
   * Factory method to create a high-level GitRepositoryService.
   * @param {Object} [options]
   * @returns {GitRepositoryService}
   */
  static createRepository(options = {}) {
    const plumbing = GitPlumbing.createDefault(options);
    return new GitRepositoryService({ plumbing });
  }

  /**
   * Verifies that the git binary is available and the CWD is a valid repository.
   * @throws {GitPlumbingError}
   */
  async verifyInstallation() {
    try {
      // Check binary
      await this.execute({ args: ['--version'] });
      
      // Check if inside a work tree
      const isInside = await this.execute({ args: ['rev-parse', '--is-inside-work-tree'] });
      if (isInside !== 'true') {
        throw new Error('Not inside a git work tree');
      }
    } catch (err) {
      throw new GitPlumbingError(`Git repository verification failed: ${err.message}`, 'GitPlumbing.verifyInstallation', { 
        originalError: err.message,
        code: 'GIT_VERIFICATION_FAILED'
      });
    }
  }

  /**
   * Executes a git command asynchronously and buffers the result.
   * Includes retry logic for lock contention and telemetry (Trace ID, Latency).
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Uint8Array} [options.input] - Optional stdin input.
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE] - Maximum buffer size.
   * @param {string} [options.traceId] - Correlation ID for the command.
   * @param {CommandRetryPolicy} [options.retryPolicy] - Strategy for retrying failed commands.
   * @returns {Promise<string>} - The trimmed stdout.
   * @throws {GitPlumbingError} - If the command fails or buffer is exceeded.
   */
  async execute({ 
    args, 
    input, 
    env,
    maxBytes = DEFAULT_MAX_BUFFER_SIZE, 
    traceId = Math.random().toString(36).substring(7),
    retryPolicy = CommandRetryPolicy.default()
  }) {
    return this.orchestrator.orchestrate({
      execute: async () => {
        const stream = await this.executeStream({ args, input, env });
        const stdout = await stream.collect({ maxBytes, asString: true });
        const result = await stream.finished;
        return { stdout, result };
      },
      retryPolicy,
      args,
      traceId
    });
  }

  /**
   * Executes a git command asynchronously and returns a universal stream.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Uint8Array} [options.input] - Optional stdin input.
   * @param {Object} [options.env] - Optional environment overrides.
   * @returns {Promise<GitStream>} - The unified stdout stream wrapper.
   * @throws {GitPlumbingError} - If command setup fails.
   */
  async executeStream({ args, input, env }) {
    this.sanitizer.sanitize(args);

    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      input,
      env
    });

    try {
      const result = await this.runner(options);
      return new GitStream(result.stdoutStream, result.exitPromise);
    } catch (err) {
      if (err instanceof GitPlumbingError) {
        throw err;
      }
      throw new GitPlumbingError(err.message, 'GitPlumbing.executeStream', { args, originalError: err });
    }
  }

  /**
   * Executes a git command and returns both stdout and exit status without throwing on non-zero exit.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {number} [options.maxBytes] - Maximum buffer size.
   * @returns {Promise<{stdout: string, status: number}>}
   */
  async executeWithStatus({ args, maxBytes }) {
    const startTime = performance.now();
    try {
      const stream = await this.executeStream({ args });
      const stdout = await stream.collect({ maxBytes, asString: true });
      const result = await stream.finished;

      return {
        stdout: stdout.trim(),
        status: result.code || 0,
        latency: performance.now() - startTime
      };
    } catch (err) {
      throw new GitPlumbingError(err.message, 'GitPlumbing.executeWithStatus', { 
        args, 
        originalError: err,
        latency: performance.now() - startTime
      });
    }
  }

  /**
   * Returns the SHA-1 of the empty tree.
   * @returns {string}
   */
  get emptyTree() {
    return GitSha.EMPTY_TREE_VALUE;
  }
}
