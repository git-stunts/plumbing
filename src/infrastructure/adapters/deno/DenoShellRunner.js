/**
 * @fileoverview Deno implementation of the shell command runner (Streaming Only)
 */

import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import EnvironmentPolicy from '../../../domain/services/EnvironmentPolicy.js';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Executes shell commands using Deno.Command and always returns a stream.
 */
export default class DenoShellRunner {
  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout }) {
    // Create a clean environment using Domain Policy
    const env = EnvironmentPolicy.filter(Deno.env.toObject());

    const cmd = new Deno.Command(command, {
      args,
      cwd,
      env,
      stdin: 'piped', 
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

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
            resolve({ code: 1, stderr: 'Command timed out', timedOut: true });
          }, timeout);
        }
      });

      const completionPromise = (async () => {
        const { code } = await child.status;
        const stderr = await stderrPromise;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        return { code, stderr, timedOut: false };
      })();

      return Promise.race([completionPromise, timeoutPromise]);
    })();

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      exitPromise
    });
  }
}