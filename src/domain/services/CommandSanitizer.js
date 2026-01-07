/**
 * @fileoverview Domain service for sanitizing git command arguments
 */

import ValidationError from '../errors/ValidationError.js';

/**
 * Sanitizes and validates git command arguments
 */
export default class CommandSanitizer {
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
    '--version',
    'help',
    'sh',
    'cat'
  ];

  static PROHIBITED_FLAGS = [
    '--upload-pack',
    '--receive-pack',
    '--ext-cmd',
    '--config',
    '-c'
  ];

  /**
   * Validates a list of arguments for potential injection or prohibited flags
   * @param {string[]} args
   * @throws {ValidationError}
   */
  static sanitize(args) {
    if (!Array.isArray(args)) {
      throw new ValidationError('Arguments must be an array', 'CommandSanitizer.sanitize');
    }

    if (args.length === 0) {
      throw new ValidationError('Arguments array cannot be empty', 'CommandSanitizer.sanitize');
    }

    // Check if the base command is allowed
    const command = args[0].toLowerCase();
    if (!this.ALLOWED_COMMANDS.includes(command)) {
      throw new ValidationError(`Prohibited git command detected: ${args[0]}`, 'CommandSanitizer.sanitize', { command: args[0] });
    }

    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new ValidationError('Each argument must be a string', 'CommandSanitizer.sanitize', { arg });
      }

      // Check for prohibited flags that could lead to command injection or configuration override
      const lowerArg = arg.toLowerCase();
      for (const prohibited of this.PROHIBITED_FLAGS) {
        if (lowerArg === prohibited || lowerArg.startsWith(`${prohibited}=`)) {
          throw new ValidationError(`Prohibited git flag detected: ${arg}`, 'CommandSanitizer.sanitize', { arg });
        }
      }
    }
    
    return args;
  }
}
