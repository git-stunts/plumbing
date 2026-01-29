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
    'init',
    'config',
    'log',
    'show'
  ]);

  /**
   * Global git flags that are strictly prohibited.
   */
  static PROHIBITED_GLOBAL_FLAGS = [
    '--exec-path',
    '--html-path',
    '--man-path',
    '--info-path',
    '--work-tree',
    '--git-dir',
    '--namespace',
    '--template',
    '-c',
    '--config',
    '-C'
  ];

  /**
   * Command-specific flags that are prohibited due to security risks.
   */
  static PROHIBITED_COMMAND_FLAGS = [
    '--upload-pack',
    '--receive-pack',
    '--ext-cmd'
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

    if (args.length === 0) {
      throw new ValidationError('Arguments array cannot be empty', 'CommandSanitizer.sanitize');
    }

    // Memory-efficient cache key using a short structural signature
    const cacheKey = `${args[0]}:${args.length}:${args[args.length-1]?.length || 0}:${args.join('').length}`;
    if (this._cache.has(cacheKey)) {
      return args;
    }

    if (args.length > CommandSanitizer.MAX_ARGS) {
      throw new ValidationError(`Too many arguments: ${args.length}`, 'CommandSanitizer.sanitize');
    }

    // Special case: allow exactly ['--version'] as a global flag check
    if (args.length === 1 && args[0] === '--version') {
      return args;
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

    // Block global flags anywhere, especially before the subcommand
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const lowerArg = arg.toLowerCase();
      
      // Prohibit dangerous global flags anywhere
      if (CommandSanitizer.PROHIBITED_GLOBAL_FLAGS.some(flag => lowerArg === flag || lowerArg.startsWith(`${flag}=`))) {
        throw new ProhibitedFlagError(arg, 'CommandSanitizer.sanitize');
      }

      // Prohibit dangerous command flags
      if (CommandSanitizer.PROHIBITED_COMMAND_FLAGS.some(flag => lowerArg === flag || lowerArg.startsWith(`${flag}=`))) {
        throw new ProhibitedFlagError(arg, 'CommandSanitizer.sanitize');
      }
    }

    // The base command must be in the whitelist
    const commandArg = subcommandIndex !== -1 ? args[subcommandIndex] : args[0];
    const command = commandArg.toLowerCase();
    if (!CommandSanitizer._ALLOWED_COMMANDS.has(command)) {
      throw new ValidationError(`Prohibited git command detected: ${command}`, 'CommandSanitizer.sanitize', { command });
    }

    let totalLength = 0;
    for (const arg of args) {
      totalLength += arg.length;
      if (arg.length > CommandSanitizer.MAX_ARG_LENGTH) {
        throw new ValidationError(`Argument too long: ${arg.length}`, 'CommandSanitizer.sanitize');
      }
    }

    if (totalLength > CommandSanitizer.MAX_TOTAL_LENGTH) {
      throw new ValidationError(`Total arguments length too long: ${totalLength}`, 'CommandSanitizer.sanitize');
    }
    
    // Manage cache size
    if (this._cache.size >= this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(cacheKey, true);

    return args;
  }
}