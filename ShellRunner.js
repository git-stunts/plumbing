import { execFile } from 'node:child_process';

/**
 * ShellRunner provides a standard CommandRunner implementation using child_process.execFile.
 */
export default class ShellRunner {
  /**
   * Executes a command.
   * @param {Object} options
   * @param {string} options.command
   * @param {string[]} options.args
   * @param {string} [options.cwd]
   * @param {string|Buffer} [options.input]
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  static async run({ command, args, cwd, input }) {
    return new Promise((resolve) => {
      const child = execFile(command, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          code: error ? error.code : 0
        });
      });

      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  }
}
