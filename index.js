/**
 * @fileoverview GitPlumbing - The primary domain service for Git plumbing operations
 */

import path from 'node:path';
import fs from 'node:fs';
import { RunnerOptionsSchema, DEFAULT_MAX_BUFFER_SIZE } from './src/ports/RunnerOptionsSchema.js';
import GitSha from './src/domain/value-objects/GitSha.js';
import GitPlumbingError from './src/domain/errors/GitPlumbingError.js';
import InvalidArgumentError from './src/domain/errors/InvalidArgumentError.js';
import CommandSanitizer from './src/domain/services/CommandSanitizer.js';
import GitCommandBuilder from './src/domain/services/GitCommandBuilder.js';
import GitStream from './src/infrastructure/GitStream.js';
import ShellRunnerFactory from './src/infrastructure/factories/ShellRunnerFactory.js';

/**
 * GitPlumbing provides a low-level, robust interface for executing Git plumbing commands.
 * Adheres to Hexagonal Architecture by defining its dependencies via ports (CommandRunner).
 */
export default class GitPlumbing {
  /**
   * @param {Object} options
   * @param {import('./src/ports/CommandRunnerPort.js').CommandRunner} options.runner - The functional port for shell execution.
   * @param {string} [options.cwd=process.cwd()] - The working directory for git operations.
   */
  constructor({ runner, cwd = process.cwd() }) {
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
  }

  /**
   * Factory method to create an instance with the default shell runner for the current environment.
   * @param {Object} [options]
   * @param {string} [options.cwd]
   * @returns {GitPlumbing}
   */
  static createDefault(options = {}) {
    return new GitPlumbing({
      runner: ShellRunnerFactory.create(),
      ...options
    });
  }

  /**
   * Verifies that the git binary is available.
   * @throws {GitPlumbingError}
   */
  async verifyInstallation() {
    try {
      await this.execute({ args: ['--version'] });
    } catch (err) {
      throw new GitPlumbingError('Git binary not found or inaccessible', 'GitPlumbing.verifyInstallation', { 
        originalError: err.message,
        code: 'GIT_NOT_FOUND'
      });
    }
  }

  /**
   * Executes a git command asynchronously and buffers the result.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Uint8Array} [options.input] - Optional stdin input.
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE] - Maximum buffer size.
   * @returns {Promise<string>} - The trimmed stdout.
   * @throws {GitPlumbingError} - If the command fails or buffer is exceeded.
   */
  async execute({ args, input, maxBytes = DEFAULT_MAX_BUFFER_SIZE }) {
    try {
      const stream = await this.executeStream({ args, input });
      const stdout = await stream.collect({ maxBytes });
      const { code, stderr } = await stream.finished;

      if (code !== 0) {
        throw new GitPlumbingError(`Git command failed with code ${code}`, 'GitPlumbing.execute', {
          args,
          stderr,
          stdout,
          code
        });
      }

      return stdout.trim();
    } catch (err) {
      if (err instanceof GitPlumbingError) {throw err;}
      throw new GitPlumbingError(err.message, 'GitPlumbing.execute', { args, originalError: err });
    }
  }

  /**
   * Executes a git command asynchronously and returns a universal stream.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Uint8Array} [options.input] - Optional stdin input.
   * @returns {Promise<GitStream>} - The unified stdout stream wrapper.
   * @throws {GitPlumbingError} - If command setup fails.
   */
  async executeStream({ args, input }) {
    CommandSanitizer.sanitize(args);

    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      input,
    });

    try {
      const result = await this.runner(options);
      return new GitStream(result.stdoutStream, result.exitPromise);
    } catch (err) {
      if (err instanceof GitPlumbingError) {throw err;}
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
    try {
      const stream = await this.executeStream({ args });
      const stdout = await stream.collect({ maxBytes });
      const { code } = await stream.finished;

      return {
        stdout: stdout.trim(),
        status: code || 0,
      };
    } catch (err) {
      throw new GitPlumbingError(err.message, 'GitPlumbing.executeWithStatus', { args, originalError: err });
    }
  }

  /**
   * Returns the SHA-1 of the empty tree.
   * @returns {string}
   */
  get emptyTree() {
    return GitSha.EMPTY_TREE_VALUE;
  }

  /**
   * Resolves a revision to a full SHA.
   * @param {Object} options
   * @param {string} options.revision
   * @returns {Promise<string>}
   * @throws {GitPlumbingError}
   */
  async revParse({ revision }) {
    const args = GitCommandBuilder.revParse().arg(revision).build();
    return await this.execute({ args });
  }

  /**
   * Updates a reference to point to a new SHA.
   * @param {Object} options
   * @param {string} options.ref
   * @param {GitSha|string} options.newSha
   * @param {GitSha|string} [options.oldSha]
   */
  async updateRef({ ref, newSha, oldSha }) {
    const gitNewSha = newSha instanceof GitSha ? newSha : new GitSha(newSha);
    const gitOldSha = oldSha ? (oldSha instanceof GitSha ? oldSha : new GitSha(oldSha)) : null;

    const args = GitCommandBuilder.updateRef()
      .arg(ref)
      .arg(gitNewSha.toString())
      .arg(gitOldSha ? gitOldSha.toString() : null)
      .build();
    await this.execute({ args });
  }

  /**
   * Deletes a reference.
   * @param {Object} options
   * @param {string} options.ref
   */
  async deleteRef({ ref }) {
    const args = GitCommandBuilder.updateRef().delete().arg(ref).build();
    await this.execute({ args });
  }
}