/**
 * @fileoverview ShellRunner facade - delegates to environment-specific implementation
 */

import ShellRunnerFactory from './src/infrastructure/factories/ShellRunnerFactory.js';
import CommandSession from './src/infrastructure/CommandSession.js';
import UnsupportedCapabilityError from './src/domain/errors/UnsupportedCapabilityError.js';
import { DEFAULT_COMMAND_TIMEOUT } from './src/ports/RunnerOptionsSchema.js';
import { SessionRunnerOptionsSchema } from './src/ports/SessionRunnerOptionsSchema.js';

/**
 * ShellRunner provides a standard CommandRunner implementation.
 * It automatically detects the environment (Node, Bun, Deno) and uses the appropriate adapter.
 */
export default class ShellRunner {
  /**
   * Opens a long-lived duplex command session using the current runtime.
   * @param {Object} options
   * @returns {Promise<CommandSession>}
   */
  static async open(options) {
    const { sessionRunner } = ShellRunnerFactory.createPorts();
    if (typeof sessionRunner !== 'function') {
      throw new UnsupportedCapabilityError('duplex command sessions', 'ShellRunner.open');
    }
    const parsed = SessionRunnerOptionsSchema.parse(options);
    return new CommandSession(await sessionRunner(parsed));
  }

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
