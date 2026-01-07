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
  async run({ command, args, cwd, input }) {
    const process = Bun.spawn([command, ...args], {
      cwd,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (input && process.stdin) {
      const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
      process.stdin.write(data);
      process.stdin.end();
    } else if (process.stdin) {
      process.stdin.end();
    }

    const stdout = await new Response(process.stdout).text();
    const stderr = await new Response(process.stderr).text();
    const code = await process.exited;

    return RunnerResultSchema.parse({
      stdout,
      stderr,
      code,
    });
  }
}
