import path from 'node:path';
import fs from 'node:fs';
import { RunnerOptionsSchema, RunnerResultSchema } from './src/ports/CommandRunnerPort.js';
import GitSha from './src/domain/value-objects/GitSha.js';
import GitPlumbingError from './src/domain/errors/GitPlumbingError.js';
import InvalidArgumentError from './src/domain/errors/InvalidArgumentError.js';
import CommandSanitizer from './src/domain/services/CommandSanitizer.js';
import GitCommandBuilder from './src/domain/services/GitCommandBuilder.js';
import GitStream from './src/infrastructure/GitStream.js';

/**
 * GitPlumbing provides a low-level, robust interface for executing Git plumbing commands.
 * It follows Dependency Inversion by accepting a 'runner' for the actual execution.
 */
export default class GitPlumbing {
  /**
   * @param {Object} options
   * @param {import('./src/ports/CommandRunnerPort.js').CommandRunner} options.runner - The async function that executes shell commands.
   * @param {string} [options.cwd=process.cwd()] - The working directory for git operations.
   */
  constructor({ runner, cwd = process.cwd() }) {
    if (typeof runner !== 'function') {
      throw new InvalidArgumentError('A functional runner is required for GitPlumbing', 'GitPlumbing.constructor');
    }
    
    // Validate CWD
    const resolvedCwd = path.resolve(cwd);
    if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
      throw new InvalidArgumentError(`Invalid working directory: ${cwd}`, 'GitPlumbing.constructor', { cwd });
    }

    this.runner = runner;
    this.cwd = resolvedCwd;
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
   * Executes a git command asynchronously.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Uint8Array} [options.input] - Optional stdin input.
   * @returns {Promise<string>} - The trimmed stdout.
   * @throws {GitPlumbingError} - If the command fails.
   */
  async execute({ args, input }) {
    CommandSanitizer.sanitize(args);

    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      input,
    });

    try {
      const rawResult = await this.runner(options);
      const result = RunnerResultSchema.parse(rawResult);

      if (result.code !== 0 && result.code !== undefined) {
        throw new GitPlumbingError(`Git command failed with code ${result.code}`, 'GitPlumbing.execute', {
          args,
          stderr: result.stderr,
          stdout: result.stdout,
          code: result.code
        });
      }

      return result.stdout.trim();
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
   * @returns {Promise<GitStream>} - The unified stdout stream.
   * @throws {GitPlumbingError} - If command setup fails.
   */
  async executeStream({ args, input }) {
    CommandSanitizer.sanitize(args);

    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      input,
      stream: true
    });

    try {
      const rawResult = await this.runner(options);
      const result = RunnerResultSchema.parse(rawResult);

      if (!result.stdoutStream) {
        throw new GitPlumbingError('Failed to initialize command stream', 'GitPlumbing.executeStream', { args });
      }

      return new GitStream(result.stdoutStream, result.exitPromise);
    } catch (err) {
      if (err instanceof GitPlumbingError) {throw err;}
      throw new GitPlumbingError(err.message, 'GitPlumbing.executeStream', { args, originalError: err });
    }
  }

  /**
   * Specifically handles commands that might exit with 1 (like diff).
   * @param {Object} options
   * @param {string[]} options.args
   * @returns {Promise<{stdout: string, status: number}>}
   */
  async executeWithStatus({ args }) {
    CommandSanitizer.sanitize(args);

    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
    });

    try {
      const rawResult = await this.runner(options);
      const result = RunnerResultSchema.parse(rawResult);

      return {
        stdout: result.stdout.trim(),
        status: result.code || 0,
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
    return '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
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
