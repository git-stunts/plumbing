/**
 * @fileoverview Deno implementation of the shell command runner
 */

import { RunnerResultSchema } from '../../../../contract.js';

/**
 * Executes shell commands using Deno.Command
 */
export default class DenoShellRunner {
  /**
   * Executes a command
   * @type {import('../../../../contract.js').CommandRunner}
   */
  async run({ command, args, cwd, input }) {
    const cmd = new Deno.Command(command, {
      args,
      cwd,
      stdin: input ? 'piped' : 'null',
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

    if (input && child.stdin) {
      const writer = child.stdin.getWriter();
      writer.write(typeof input === 'string' ? new TextEncoder().encode(input) : input);
      await writer.close();
    }

    const { code, stdout, stderr } = await child.output();

    return RunnerResultSchema.parse({
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      code,
    });
  }
}
