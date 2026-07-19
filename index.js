/**
 * @fileoverview GitPlumbing - The primary domain service for Git plumbing operations
 */

import { RunnerOptionsSchema, DEFAULT_MAX_BUFFER_SIZE } from './src/ports/RunnerOptionsSchema.js';
import { SessionRunnerOptionsSchema } from './src/ports/SessionRunnerOptionsSchema.js';

// Value Objects
import GitSha from './src/domain/value-objects/GitSha.js';
import GitRef from './src/domain/value-objects/GitRef.js';
import GitSignature from './src/domain/value-objects/GitSignature.js';
import CommandRetryPolicy from './src/domain/value-objects/CommandRetryPolicy.js';

// Entities
import GitBlob from './src/domain/entities/GitBlob.js';
import GitTree from './src/domain/entities/GitTree.js';

// Services
import GitPlumbingError from './src/domain/errors/GitPlumbingError.js';
import GitObjectMissingError from './src/domain/errors/GitObjectMissingError.js';
import GitProtocolError from './src/domain/errors/GitProtocolError.js';
import InvalidArgumentError from './src/domain/errors/InvalidArgumentError.js';
import UnsupportedCapabilityError from './src/domain/errors/UnsupportedCapabilityError.js';
import CommandSanitizer from './src/domain/services/CommandSanitizer.js';
import ShellRunnerFactory from './src/infrastructure/factories/ShellRunnerFactory.js';
import GitRepositoryService from './src/domain/services/GitRepositoryService.js';
import ExecutionOrchestrator from './src/domain/services/ExecutionOrchestrator.js';
import GitBinaryChecker from './src/domain/services/GitBinaryChecker.js';
import GitCommandBuilder from './src/domain/services/GitCommandBuilder.js';
import GitPersistenceService from './src/domain/services/GitPersistenceService.js';

// Infrastructure
import GitStream from './src/infrastructure/GitStream.js';
import CommandSession from './src/infrastructure/CommandSession.js';
import GitCatFileSession from './src/infrastructure/protocols/GitCatFileSession.js';
import GitFastImportSession from './src/infrastructure/protocols/GitFastImportSession.js';
import GitMktreeSession from './src/infrastructure/protocols/GitMktreeSession.js';

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function normalizePruneExpiry(expiresBefore) {
  if (typeof expiresBefore !== 'string' || !CANONICAL_UTC_TIMESTAMP.test(expiresBefore)) {
    throw new InvalidArgumentError(
      'expiresBefore must be a canonical UTC timestamp',
      'GitPlumbing.inspectPrunableObjects',
      { expiresBefore }
    );
  }
  const parsed = Date.parse(expiresBefore);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== expiresBefore) {
    throw new InvalidArgumentError(
      'expiresBefore must be a valid canonical UTC timestamp',
      'GitPlumbing.inspectPrunableObjects',
      { expiresBefore }
    );
  }
  return expiresBefore;
}

/**
 * Named exports for public API
 */
export {
  GitSha,
  GitRef,
  GitSignature,
  GitBlob,
  GitTree,
  GitPersistenceService,
  GitCommandBuilder,
  ShellRunnerFactory,
  GitPlumbingError,
  GitObjectMissingError,
  GitProtocolError,
  InvalidArgumentError,
  UnsupportedCapabilityError,
  CommandSession,
  GitCatFileSession,
  GitFastImportSession,
  GitMktreeSession,
  CommandRetryPolicy,
  GitRepositoryService
};

/**
 * GitPlumbing provides a low-level, robust interface for executing Git plumbing commands.
 * Adheres to Hexagonal Architecture by defining its dependencies via ports (CommandRunner).
 */
export default class GitPlumbing {
  /**
   * @param {Object} options
   * @param {import('./src/ports/CommandRunnerPort.js').CommandRunner} options.runner - The functional port for shell execution.
   * @param {import('./src/ports/CommandSessionRunnerPort.js').CommandSessionRunner} [options.sessionRunner] - Optional duplex process port.
   * @param {string} [options.cwd='.'] - The working directory for git operations.
   * @param {CommandSanitizer} [options.sanitizer] - Injected sanitizer.
   * @param {ExecutionOrchestrator} [options.orchestrator] - Injected orchestrator.
   */
  constructor({ 
    runner,
    sessionRunner,
    cwd = '.',
    sanitizer = new CommandSanitizer(),
    orchestrator = new ExecutionOrchestrator()
  }) {
    if (typeof runner !== 'function') {
      throw new InvalidArgumentError('A functional runner port is required for GitPlumbing', 'GitPlumbing.constructor');
    }

    /** @private */
    this.runner = runner;
    /** @private */
    this.sessionRunner = sessionRunner;
    /** @private */
    this.cwd = cwd;
    /** @private */
    this.sanitizer = sanitizer;
    /** @private */
    this.orchestrator = orchestrator;
    /** @private */
    this.checker = new GitBinaryChecker({ plumbing: this });
  }

  /**
   * Orchestrates a full commit sequence from content to reference update.
   * Delegates to GitRepositoryService.
   * @param {Object} options
   * @returns {Promise<GitSha>} The resulting commit SHA.
   */
  async commit(options) {
    const repo = new GitRepositoryService({ plumbing: this });
    return repo.createCommitFromFiles(options);
  }

  /**
   * Factory method to create an instance with the default shell runner for the current environment.
   * @param {Object} [options]
   * @param {string} [options.cwd]
   * @param {string} [options.env] - Override environment detection.
   * @param {import('./src/ports/CommandRunnerPort.js').CommandRunner} [options.runner]
   * @param {import('./src/ports/CommandSessionRunnerPort.js').CommandSessionRunner} [options.sessionRunner]
   * @param {CommandSanitizer} [options.sanitizer]
   * @param {ExecutionOrchestrator} [options.orchestrator]
   * @returns {Promise<GitPlumbing>}
   */
  static async createDefault(options = {}) {
    const {
      cwd: requestedCwd,
      env: requestedEnv,
      runner: customRunner,
      sessionRunner: customSessionRunner,
      ...dependencies
    } = options;
    const env = requestedEnv || globalThis.process?.env?.GIT_PLUMBING_ENV;
    const cwd = requestedCwd ? await ShellRunnerFactory.validateCwd(requestedCwd) : '.';
    const ports = ShellRunnerFactory.createPorts({ env });
    return new GitPlumbing({
      ...dependencies,
      runner: customRunner ?? ports.runner,
      sessionRunner:
        customSessionRunner ?? (customRunner === undefined ? ports.sessionRunner : undefined),
      cwd
    });
  }

  /**
   * Factory method to create a high-level GitRepositoryService.
   * @param {Object} [options]
   * @returns {Promise<GitRepositoryService>}
   */
  static async createRepository(options = {}) {
    const plumbing = await GitPlumbing.createDefault(options);
    return new GitRepositoryService({ plumbing });
  }

  /**
   * Verifies that the git binary is available and the CWD is a valid repository.
   * @throws {GitPlumbingError}
   */
  async verifyInstallation() {
    await this.checker.check();
    const isInside = await this.checker.isInsideWorkTree();
    if (!isInside) {
      throw new GitPlumbingError('Not inside a git work tree', 'GitPlumbing.verifyInstallation', { 
        code: 'GIT_NOT_IN_WORK_TREE'
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
   * Opens a long-lived Git process with writable stdin and streaming stdout.
   * Sessions have no implicit timeout; their owner must close or terminate them.
   * @param {Object} options
   * @param {string[]} options.args - Array of Git arguments.
   * @param {Object} [options.env] - Optional environment overrides.
   * @param {number} [options.maxStderrBytes] - Maximum retained stderr bytes.
   * @param {number} [options.timeout] - Optional session lifetime in milliseconds.
   * @returns {Promise<CommandSession>}
   */
  async openSession({ args, env, maxStderrBytes, timeout }) {
    this.sanitizer.sanitize(args);
    if (typeof this.sessionRunner !== 'function') {
      throw new UnsupportedCapabilityError(
        'duplex command sessions',
        'GitPlumbing.openSession'
      );
    }
    const options = SessionRunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      env,
      maxStderrBytes,
      timeout
    });
    try {
      return new CommandSession(await this.sessionRunner(options));
    } catch (error) {
      if (error instanceof GitPlumbingError) {
        throw error;
      }
      throw new GitPlumbingError(error.message, 'GitPlumbing.openSession', {
        args,
        originalError: error
      });
    }
  }

  /**
   * Opens a typed `git cat-file --batch-command` reader.
   * @param {Object} [options]
   * @param {boolean} [options.buffered=true]
   * @param {Object} [options.env]
   * @param {number} [options.maxStderrBytes]
   * @param {number} [options.timeout]
   * @returns {Promise<GitCatFileSession>}
   */
  async openCatFileSession({ buffered = true, env, maxStderrBytes, timeout } = {}) {
    const session = await this.openSession({
      args: ['cat-file', '--batch-command', ...(buffered ? ['--buffer'] : [])],
      env,
      maxStderrBytes,
      timeout
    });
    return new GitCatFileSession(session, { buffered });
  }

  /**
   * Opens a typed `git mktree --batch -z` writer.
   * @param {Object} [options]
   * @param {Object} [options.env]
   * @param {number} [options.maxStderrBytes]
   * @param {number} [options.timeout]
   * @returns {Promise<GitMktreeSession>}
   */
  async openMktreeSession({ env, maxStderrBytes, timeout } = {}) {
    const session = await this.openSession({
      args: ['mktree', '--batch', '-z'],
      env,
      maxStderrBytes,
      timeout
    });
    return new GitMktreeSession(session);
  }

  /**
   * Opens a typed `git fast-import` blob writer.
   * @param {Object} [options]
   * @param {Object} [options.env]
   * @param {number} [options.maxStderrBytes]
   * @param {number} [options.timeout]
   * @returns {Promise<GitFastImportSession>}
   */
  async openFastImportSession({ env, maxStderrBytes, timeout } = {}) {
    const session = await this.openSession({
      args: ['fast-import', '--quiet', '--done'],
      env,
      maxStderrBytes,
      timeout
    });
    return new GitFastImportSession(session);
  }

  /**
   * Streams the loose unreachable objects Git would prune before a cutoff.
   * The command is unconditionally dry-run and never mutates repository state.
   *
   * @param {Object} options
   * @param {string} options.expiresBefore - Canonical UTC timestamp.
   * @returns {Promise<GitStream>}
   */
  async inspectPrunableObjects({ expiresBefore } = {}) {
    const expiry = normalizePruneExpiry(expiresBefore);
    return await this.executeStream({
      args: ['prune', '--dry-run', '--verbose', '--no-progress', `--expire=${expiry}`]
    });
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
