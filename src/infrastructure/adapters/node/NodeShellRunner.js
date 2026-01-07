/**
 * @fileoverview Node.js implementation of the shell command runner
 */

import { execFile } from 'node:child_process';
import { RunnerResultSchema } from '../../../../contract.js';

/**
 * Executes shell commands using Node.js child_process.execFile
 */
export default class NodeShellRunner {
  static MAX_BUFFER = 100 * 1024 * 1024; // 100MB

  /**
   * Executes a command
   * @type {import('../../../../contract.js').CommandRunner}
   */
  async run({ command, args, cwd, input }) {
    return new Promise((resolve) => {
      const child = execFile(command, args, { 
        cwd, 
        encoding: 'utf8', 
        maxBuffer: NodeShellRunner.MAX_BUFFER 
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
}
