import { RunnerOptionsSchema, RunnerResultSchema } from './contract.js';

/**
 * GitPlumbing provides a low-level, robust interface for executing Git plumbing commands.
 * It follows Dependency Inversion by accepting a 'runner' for the actual execution.
 */
export default class GitPlumbing {
  /**
   * @param {Object} options
   * @param {import('./contract.js').CommandRunner} options.runner - The async function that executes shell commands.
   * @param {string} [options.cwd=process.cwd()] - The working directory for git operations.
   */
  constructor({ runner, cwd = process.cwd() }) {
    if (typeof runner !== 'function') {
      throw new Error('A functional runner is required for GitPlumbing');
    }
    this.runner = runner;
    this.cwd = cwd;
  }

  /**
   * Executes a git command asynchronously.
   * @param {Object} options
   * @param {string[]} options.args - Array of git arguments.
   * @param {string|Buffer} [options.input] - Optional stdin input.
   * @returns {Promise<string>} - The trimmed stdout.
   * @throws {Error} - If the command fails (non-zero exit code).
   */
  async execute({ args, input }) {
    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
      input,
    });

    const rawResult = await this.runner(options);
    const result = RunnerResultSchema.parse(rawResult);

    if (result.code !== 0 && result.code !== undefined) {
      const err = new Error(`Git command failed with code ${result.code}: git ${args.join(' ')}
${result.stderr}`);
      err.stdout = result.stdout;
      err.stderr = result.stderr;
      err.code = result.code;
      throw err;
    }

    return result.stdout.trim();
  }

  /**
   * Specifically handles commands that might exit with 1 (like diff).
   * @param {Object} options
   * @param {string[]} options.args
   * @returns {Promise<{stdout: string, status: number}>}
   */
  async executeWithStatus({ args }) {
    const options = RunnerOptionsSchema.parse({
      command: 'git',
      args,
      cwd: this.cwd,
    });

    const rawResult = await this.runner(options);
    const result = RunnerResultSchema.parse(rawResult);

    return {
      stdout: result.stdout.trim(),
      status: result.code || 0,
    };
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
   * @returns {Promise<string|null>}
   */
  async revParse({ revision }) {
    try {
      return await this.execute({ args: ['rev-parse', revision] });
    } catch {
      return null;
    }
  }

  /**
   * Updates a reference to point to a new SHA.
   * @param {Object} options
   * @param {string} options.ref
   * @param {string} options.newSha
   * @param {string} [options.oldSha]
   */
  async updateRef({ ref, newSha, oldSha }) {
    const args = ['update-ref', ref, newSha];
    if (oldSha) args.push(oldSha);
    await this.execute({ args });
  }

  /**
   * Deletes a reference.
   * @param {Object} options
   * @param {string} options.ref
   */
  async deleteRef({ ref }) {
    await this.execute({ args: ['update-ref', '-d', ref] });
  }
}
