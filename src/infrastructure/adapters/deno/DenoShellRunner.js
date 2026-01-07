/**
 * @fileoverview Deno implementation of the shell command runner
 */

import { RunnerResultSchema } from '../../../ports/CommandRunnerPort.js';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Executes shell commands using Deno.Command
 */
export default class DenoShellRunner {
  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
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

      const stderrPromise = (async () => {
        let stderr = '';
        if (child.stderr) {
          for await (const chunk of child.stderr) {
            stderr += DECODER.decode(chunk);
          }
        }
        return stderr;
      })();

      const exitPromise = (async () => {
        let timeoutId;
        const timeoutPromise = new Promise((resolve) => {
          if (timeout) {
            timeoutId = setTimeout(() => {
              try { child.kill("SIGTERM"); } catch { /* ignore */ }
              resolve({ code: 1, stderr: 'Command timed out' });
            }, timeout);
          }
        });

        const completionPromise = (async () => {
          const { code } = await child.status;
          const stderr = await stderrPromise;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return { code, stderr };
        })();

        return Promise.race([completionPromise, timeoutPromise]);
      })();

      return RunnerResultSchema.parse({
        stdoutStream: child.stdout,
        code: 0,
        exitPromise
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