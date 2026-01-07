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

  /** @private */
  static _registry = new Map();

  /**
   * Registers a custom runner class.
   * @param {string} name
   * @param {Function} RunnerClass
   */
  static register(name, RunnerClass) {
    this._registry.set(name, RunnerClass);
  }

  /**
   * Creates a shell runner for the current environment
   * @param {Object} [options]
   * @param {string} [options.env] - Override environment detection.
   * @returns {import('../../ports/CommandRunnerPort.js').CommandRunner} A functional shell runner
   */
  static create(options = {}) {
    const env = options.env || this._detectEnvironment();
    
    // Check registry first
    if (this._registry.has(env)) {
      const RunnerClass = this._registry.get(env);
      const runner = new RunnerClass();
      return runner.run.bind(runner);
    }

    const runners = {
      [this.ENV_BUN]: BunShellRunner,
      [this.ENV_DENO]: DenoShellRunner,
      [this.ENV_NODE]: NodeShellRunner
    };

    const RunnerClass = runners[env];
    if (!RunnerClass) {
      throw new Error(`Unsupported environment: ${env}`);
    }

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