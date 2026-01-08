/**
 * @fileoverview Domain service for sanitizing git command arguments
 */

import ValidationError from '../errors/ValidationError.js';
import ProhibitedFlagError from '../errors/ProhibitedFlagError.js';

/**
 * Sanitizes and validates git command arguments.
 * Implements a defense-in-depth strategy by whitelisting commands,
 * blocking dangerous flags, and preventing global flag escapes.
 */
export default class CommandSanitizer {
  static MAX_ARGS = 1000;
  static MAX_ARG_LENGTH = 8192;
  static MAX_TOTAL_LENGTH = 65536;

  /**
   * Comprehensive whitelist of allowed git plumbing and essential porcelain commands.
   * @private
   */
  static _ALLOWED_COMMANDS = new Set([
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
  ]);

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
   * Global git flags that are prohibited if they appear before the subcommand.
   */
  static GLOBAL_FLAGS = [
    '-C',
    '-c',
    '--git-dir'
  ];

  /**
   * Dynamically allows a command.
   * @param {string} commandName
   */
  static allow(commandName) {
    CommandSanitizer._ALLOWED_COMMANDS.add(commandName.toLowerCase());
  }

  /**
   * @param {Object} [options]
   * @param {number} [options.maxCacheSize=100]
   */
  constructor({ maxCacheSize = 100 } = {}) {
    /** @private */
    this._cache = new Map();
    /** @private */
    this._maxCacheSize = maxCacheSize;
  }

  /**
   * Validates a list of arguments for potential injection or prohibited flags.
   * Includes memoization to skip re-validation of repetitive commands.
   * @param {string[]} args - The array of git arguments to sanitize.
   * @returns {string[]} The validated arguments array.
   * @throws {ValidationError|ProhibitedFlagError} If validation fails.
   */
  sanitize(args) {
    if (!Array.isArray(args)) {
      throw new ValidationError('Arguments must be an array', 'CommandSanitizer.sanitize');
    }

    // Simple cache key: joined arguments
    const cacheKey = args.join('\0');
    if (this._cache.has(cacheKey)) {
      return args;
    }

    if (args.length === 0) {
      throw new ValidationError('Arguments array cannot be empty', 'CommandSanitizer.sanitize');
    }

    if (args.length > CommandSanitizer.MAX_ARGS) {
      throw new ValidationError(`Too many arguments: ${args.length}`, 'CommandSanitizer.sanitize');
    }

    // Find the first non-flag argument to identify the subcommand
    let subcommandIndex = -1;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg !== 'string') {
        throw new ValidationError('Each argument must be a string', 'CommandSanitizer.sanitize', { arg });
      }
      if (!arg.startsWith('-')) {
        subcommandIndex = i;
        break;
      }
    }

    // Block global flags if they appear before the subcommand
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const lowerArg = arg.toLowerCase();
      
      // If we haven't reached the subcommand yet, check for prohibited global flags
      if (subcommandIndex === -1 || i < subcommandIndex) {
        if (CommandSanitizer.GLOBAL_FLAGS.some(flag => lowerArg === flag.toLowerCase() || lowerArg.startsWith(`${flag.toLowerCase()}=`))) {
          throw new ProhibitedFlagError(arg, 'CommandSanitizer.sanitize', { 
            message: `Global flag "${arg}" is prohibited before the subcommand.` 
          });
        }
      }
    }

    // The base command (after global flags) must be in the whitelist
    const commandArg = subcommandIndex !== -1 ? args[subcommandIndex] : args[0];
    if (typeof commandArg !== 'string') {
      throw new ValidationError('Command must be a string', 'CommandSanitizer.sanitize', { command: commandArg });
    }
    
    const command = commandArg.toLowerCase();
    if (!CommandSanitizer._ALLOWED_COMMANDS.has(command)) {
      throw new ValidationError(`Prohibited git command detected: ${command}`, 'CommandSanitizer.sanitize', { command });
    }

    let totalLength = 0;
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new ValidationError('Each argument must be a string', 'CommandSanitizer.sanitize', { arg });
      }

      if (arg.length > CommandSanitizer.MAX_ARG_LENGTH) {
        throw new ValidationError(`Argument too long: ${arg.length}`, 'CommandSanitizer.sanitize');
      }

      totalLength += arg.length;

      const lowerArg = arg.toLowerCase();

      // Strengthen configuration flag blocking
      if (lowerArg === '-c' || lowerArg === '--config' || lowerArg.startsWith('--config=')) {
        throw new ProhibitedFlagError(arg, 'CommandSanitizer.sanitize');
      }

      // Check for other prohibited flags
      for (const prohibited of CommandSanitizer.PROHIBITED_FLAGS) {
        if (lowerArg === prohibited || lowerArg.startsWith(`${prohibited}=`)) {
          throw new ProhibitedFlagError(arg, 'CommandSanitizer.sanitize');
        }
      }
    }

    if (totalLength > CommandSanitizer.MAX_TOTAL_LENGTH) {
      throw new ValidationError(`Total arguments length too long: ${totalLength}`, 'CommandSanitizer.sanitize');
    }
    
    // Manage cache size (LRU-ish: delete oldest entry)
    if (this._cache.size >= this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(cacheKey, true);

    return args;
  }
}
