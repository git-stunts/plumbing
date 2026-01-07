/**
 * @fileoverview Factory for creating shell runners based on the environment
 */

import NodeShellRunner from '../adapters/node/NodeShellRunner.js';
import BunShellRunner from '../adapters/bun/BunShellRunner.js';
import DenoShellRunner from '../adapters/deno/DenoShellRunner.js';

/**
 * Factory for shell runners
 */
export default class ShellRunnerFactory {
  static ENV_BUN = 'bun';
  static ENV_DENO = 'deno';
  static ENV_NODE = 'node';

  /**
   * Creates a shell runner for the current environment
   * @returns {import('../../ports/CommandRunnerPort.js').CommandRunner} A functional shell runner
   */
  static create() {
    const env = this._detectEnvironment();
    
    const runners = {
      [this.ENV_BUN]: BunShellRunner,
      [this.ENV_DENO]: DenoShellRunner,
      [this.ENV_NODE]: NodeShellRunner
    };

    const RunnerClass = runners[env];
    const runner = new RunnerClass();
    return runner.run.bind(runner);
  }

  /**
   * Detects the current execution environment
   * @private
   * @returns {string}
   */
  static _detectEnvironment() {
    if (typeof Bun !== 'undefined') {
      return this.ENV_BUN;
    }
    if (typeof Deno !== 'undefined') {
      return this.ENV_DENO;
    }
    return this.ENV_NODE;
  }
}