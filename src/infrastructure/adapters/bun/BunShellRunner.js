/**
 * @fileoverview Bun implementation of the shell command runner
 */

import { RunnerResultSchema } from '../../../ports/CommandRunnerPort.js';

/**
 * Executes shell commands using Bun.spawn
 */
export default class BunShellRunner {
  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout, stream }) {
    const process = Bun.spawn([command, ...args], {
      cwd,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (stream) {
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
              resolve({ code: 1, stderr: 'Command timed out' });
            }, timeout);
          }
        });

        const completionPromise = (async () => {
          const code = await process.exited;
          const stderr = await new Response(process.stderr).text();
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return { code, stderr };
        })();

        return Promise.race([completionPromise, timeoutPromise]);
      })();

      return RunnerResultSchema.parse({
        stdoutStream: process.stdout,
        code: 0,
        exitPromise
      });
    }

    // Handle timeout for non-streaming
    let timer;
    if (timeout) {
      timer = setTimeout(() => {
        try { process.kill(); } catch { /* ignore */ }
      }, timeout);
    }

    try {
      if (input) {
        process.stdin.write(input);
        process.stdin.end();
      } else {
        process.stdin.end();
      }

      const stdoutPromise = new Response(process.stdout).text();
      const stderrPromise = new Response(process.stderr).text();
      
      const [stdout, stderr, code] = await Promise.all([
        stdoutPromise,
        stderrPromise,
        process.exited
      ]);

      return RunnerResultSchema.parse({
        stdout,
        stderr,
        code,
      });
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}