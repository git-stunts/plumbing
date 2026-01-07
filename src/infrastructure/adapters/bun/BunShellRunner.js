/**
 * @fileoverview Bun implementation of the shell command runner (Streaming Only)
 */

import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import EnvironmentPolicy from '../../../domain/services/EnvironmentPolicy.js';

/**
 * Executes shell commands using Bun.spawn and always returns a stream.
 */
export default class BunShellRunner {
  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout }) {
    // Create a clean environment using Domain Policy
    const env = EnvironmentPolicy.filter(globalThis.process?.env || {});

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