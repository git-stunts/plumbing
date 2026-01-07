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
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout }) {
    const child = spawn(command, args, { cwd });

    if (child.stdin) {
      if (input) {
        child.stdin.end(input);
      } else {
        child.stdin.end();
      }
    }

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      // Small buffer for stderr to provide context on failure
      if (stderr.length < DEFAULT_MAX_STDERR_SIZE) {
        stderr += chunk.toString();
      }
    });

    const exitPromise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ code: 1, stderr: `${stderr}\n[Command timed out after ${timeout}ms]` });
      }, timeout);

      child.on('exit', (code) => {
        clearTimeout(timeoutId);
        resolve({ code: code ?? 1, stderr });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({ code: 1, stderr: `${stderr}\n${err.message}` });
      });
    });

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      exitPromise
    });
  }
}