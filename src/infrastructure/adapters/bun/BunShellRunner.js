/**
 * @fileoverview Bun implementation of the shell command runner (Streaming Only)
 */

import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';

/**
 * Executes shell commands using Bun.spawn and always returns a stream.
 */
export default class BunShellRunner {
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
    for (const key of BunShellRunner._ALLOWED_ENV) {
      if (globalEnv[key] !== undefined) {
        env[key] = globalEnv[key];
      }
    }

    const process = Bun.spawn([command, ...args], {
      cwd,
      env,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    } else {
      process.stdin.end();
    }

    const exitPromise = (async () => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve) => {
        if (timeout) {
          timeoutId = setTimeout(() => {
            try { process.kill(); } catch { /* ignore */ }
            resolve({ code: 1, stderr: 'Command timed out', timedOut: true });
          }, timeout);
        }
      });

      const completionPromise = (async () => {
        const code = await process.exited;
        const stderr = await new Response(process.stderr).text();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        return { code, stderr, timedOut: false };
      })();

      return Promise.race([completionPromise, timeoutPromise]);
    })();

    return RunnerResultSchema.parse({
      stdoutStream: process.stdout,
      exitPromise
    });
  }
}