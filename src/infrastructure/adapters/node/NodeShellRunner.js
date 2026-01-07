/**
 * @fileoverview Node.js implementation of the shell command runner
 */

import { execFile, spawn } from 'node:child_process';
import { RunnerResultSchema } from '../../../../contract.js';

/**
 * Executes shell commands using Node.js child_process.execFile or spawn
 */
export default class NodeShellRunner {
  static MAX_BUFFER = 100 * 1024 * 1024; // 100MB

  /**
   * Executes a command
   * @type {import('../../../../contract.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout, stream }) {
    if (stream) {
      return this._runStream({ command, args, cwd, input, timeout });
    }

    return new Promise((resolve) => {
      const child = execFile(command, args, { 
        cwd, 
        encoding: 'utf8', 
        maxBuffer: NodeShellRunner.MAX_BUFFER,
        timeout
      }, (error, stdout, stderr) => {
        resolve(RunnerResultSchema.parse({
          stdout: stdout || '',
          stderr: stderr || '',
          code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0)
        }));
      });

      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }

  /**
   * Executes a command and returns a stream
   * @private
   */
  async _runStream({ command, args, cwd, input, timeout }) {
    const child = spawn(command, args, { cwd });

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    // Handle timeout
    const timeoutId = setTimeout(() => {
      child.kill();
    }, timeout);

    child.on('exit', () => clearTimeout(timeoutId));

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      code: 0 // Code is only known after exit, but for streaming we return immediately
    });
  }
}
