/**
 * @fileoverview Deno implementation of the shell command runner
 */

import { RunnerResultSchema } from '../../../../contract.js';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Executes shell commands using Deno.Command
 */
export default class DenoShellRunner {
  /**
   * Executes a command
   * @type {import('../../../../contract.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout, stream }) {
    const cmd = new Deno.Command(command, {
      args,
      cwd,
      stdin: 'piped', 
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

    if (stream) {
      if (input && child.stdin) {
        const writer = child.stdin.getWriter();
        writer.write(typeof input === 'string' ? ENCODER.encode(input) : input);
        await writer.close();
      } else if (child.stdin) {
        await child.stdin.close();
      }
      return RunnerResultSchema.parse({
        stdoutStream: child.stdout,
        code: 0
      });
    }

    // Handle timeout for non-streaming
    let timer;
    if (timeout) {
      timer = setTimeout(() => {
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      }, timeout);
    }

    try {
      if (input && child.stdin) {
        const writer = child.stdin.getWriter();
        writer.write(typeof input === 'string' ? ENCODER.encode(input) : input);
        await writer.close();
      } else if (child.stdin) {
        await child.stdin.close();
      }

      const { code, stdout, stderr } = await child.output();

      return RunnerResultSchema.parse({
        stdout: DECODER.decode(stdout),
        stderr: DECODER.decode(stderr),
        code,
      });
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}