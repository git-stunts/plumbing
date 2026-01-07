/**
 * @fileoverview Node.js implementation of the shell command runner (Streaming Only)
 */

import { spawn } from 'node:child_process';
import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import { DEFAULT_MAX_STDERR_SIZE } from '../../../ports/RunnerOptionsSchema.js';

/**
 * Executes shell commands using Node.js spawn and always returns a stream.
 */
export default class NodeShellRunner {
  /**
   * List of environment variables allowed to be passed to the git process.
   * @private
   */
  static _ALLOWED_ENV = [
    'PATH',
    'GIT_EXEC_PATH',
    'GIT_TEMPLATE_DIR',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_ATTR_NOSYSTEM',
    'GIT_CONFIG_PARAMETERS'
  ];

  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout }) {
    // Create a clean environment
    const env = {};
    const globalEnv = globalThis.process?.env || {};
    for (const key of NodeShellRunner._ALLOWED_ENV) {
      if (globalEnv[key] !== undefined) {
        env[key] = globalEnv[key];
      }
    }

    const child = spawn(command, args, { cwd, env });

    if (child.stdin) {
      if (input) {
        child.stdin.end(input);
      } else {
        child.stdin.end();
      }
    }

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < DEFAULT_MAX_STDERR_SIZE) {
        stderr += chunk.toString();
      }
    });

    const exitPromise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ code: 1, stderr, timedOut: true });
      }, timeout);

      child.on('exit', (code) => {
        clearTimeout(timeoutId);
        resolve({ code: code ?? 1, stderr, timedOut: false });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({ code: 1, stderr: `${stderr}\n${err.message}`, timedOut: false, error: err });
      });
    });

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      exitPromise
    });
  }
}
