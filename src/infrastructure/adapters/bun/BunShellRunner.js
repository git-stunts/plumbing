/**
 * @fileoverview Bun implementation of the shell command runner
 */

import { RunnerResultSchema } from '../../../../contract.js';

/**
 * Executes shell commands using Bun.spawn
 */
export default class BunShellRunner {
  /**
   * Executes a command
   * @type {import('../../../../contract.js').CommandRunner}
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
      return RunnerResultSchema.parse({
        stdoutStream: process.stdout,
        code: 0
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