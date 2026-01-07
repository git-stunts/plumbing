/**
 * @fileoverview ShellRunner facade - delegates to environment-specific implementation
 */

import ShellRunnerFactory from './src/infrastructure/factories/ShellRunnerFactory.js';
import { DEFAULT_COMMAND_TIMEOUT } from './src/ports/RunnerOptionsSchema.js';

/**
 * ShellRunner provides a standard CommandRunner implementation.
 * It automatically detects the environment (Node, Bun, Deno) and uses the appropriate adapter.
 */
export default class ShellRunner {
  /**
   * Executes a command.
   * @param {Object} options
   * @param {string} options.command
   * @param {string[]} options.args
   * @param {string} [options.cwd]
   * @param {string|Uint8Array} [options.input]
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  static async run(options) {
    const runner = ShellRunnerFactory.create();
    return runner({
      timeout: DEFAULT_COMMAND_TIMEOUT,
      ...options
    });
  }
}