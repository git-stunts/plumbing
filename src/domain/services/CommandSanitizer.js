/**
 * @fileoverview Domain service for sanitizing git command arguments
 */

import ValidationError from '../errors/ValidationError.js';

/**
 * Sanitizes and validates git command arguments
 */
export default class CommandSanitizer {
  static MAX_ARGS = 1000;
  static MAX_ARG_LENGTH = 8192;
  static MAX_TOTAL_LENGTH = 65536;

  /**
   * Comprehensive whitelist of allowed git plumbing and essential porcelain commands.
   */
  static ALLOWED_COMMANDS = [
    'rev-parse',
    'update-ref',
    'cat-file',
    'hash-object',
    'ls-tree',
    'commit-tree',
    'write-tree',
    'read-tree',
    'rev-list',
    'mktree',
    'unpack-objects',
    'symbolic-ref',
    'for-each-ref',
    'show-ref',
    'diff-tree',
    'diff-index',
    'diff-files',
    'merge-base',
    'ls-files',
    'check-ignore',
    'check-attr',
    '--version',
    'init',
    'config'
  ];

  /**
   * Flags that are strictly prohibited due to security risks or environment interference.
   */
  static PROHIBITED_FLAGS = [
    '--upload-pack',
    '--receive-pack',
    '--ext-cmd',
    '--exec-path',
    '--html-path',
    '--man-path',
    '--info-path',
    '--work-tree',
    '--git-dir',
    '--namespace',
    '--template'
  ];

  /**
   * Validates a list of arguments for potential injection or prohibited flags.
   * @param {string[]} args - The array of git arguments to sanitize.
   * @returns {string[]} The validated arguments array.
   * @throws {import('../errors/ValidationError.js').default} If validation fails.
   */
  static sanitize(args) {
    if (!Array.isArray(args)) {
      throw new ValidationError('Arguments must be an array', 'CommandSanitizer.sanitize');
    }

    if (args.length === 0) {
      throw new ValidationError('Arguments array cannot be empty', 'CommandSanitizer.sanitize');
    }

    if (args.length > this.MAX_ARGS) {
      throw new ValidationError(`Too many arguments: ${args.length}`, 'CommandSanitizer.sanitize');
    }

    // Check if the base command is allowed
    const command = args[0].toLowerCase();
    if (!this.ALLOWED_COMMANDS.includes(command)) {
      throw new ValidationError(`Prohibited git command detected: ${args[0]}`, 'CommandSanitizer.sanitize', { command: args[0] });
    }

    let totalLength = 0;
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new ValidationError('Each argument must be a string', 'CommandSanitizer.sanitize', { arg });
      }

      if (arg.length > this.MAX_ARG_LENGTH) {
        throw new ValidationError(`Argument too long: ${arg.length}`, 'CommandSanitizer.sanitize');
      }

      totalLength += arg.length;

      const lowerArg = arg.toLowerCase();

      // Strengthen configuration flag blocking: Block -c or --config anywhere
      if (lowerArg === '-c' || lowerArg === '--config' || lowerArg.startsWith('--config=')) {
        throw new ValidationError(`Configuration overrides are prohibited: ${arg}`, 'CommandSanitizer.sanitize');
      }

      // Check for other prohibited flags
      for (const prohibited of this.PROHIBITED_FLAGS) {
        if (lowerArg === prohibited || lowerArg.startsWith(`${prohibited}=`)) {
          throw new ValidationError(`Prohibited git flag detected: ${arg}`, 'CommandSanitizer.sanitize', { arg });
        }
      }
    }

    if (totalLength > this.MAX_TOTAL_LENGTH) {
      throw new ValidationError(`Total arguments length too long: ${totalLength}`, 'CommandSanitizer.sanitize');
    }
    
    return args;
  }
}