/**
 * @fileoverview Custom error for prohibited git flags
 */

import GitPlumbingError from './GitPlumbingError.js';

/**
 * Error thrown when a prohibited git flag is detected
 */
export default class ProhibitedFlagError extends GitPlumbingError {
  /**
   * @param {string} flag - The prohibited flag detected
   * @param {string} operation - The operation being performed
   * @param {Object} [details] - Additional details or overrides
   * @param {string} [details.message] - Custom error message
   */
  constructor(flag, operation, details = {}) {
    const defaultMessage = `Prohibited git flag detected: ${flag}. Using flags like --work-tree or --git-dir is forbidden for security and isolation. Please use the 'cwd' option or GitRepositoryService for scoped operations. See README.md for more details.`;
    const message = details.message || defaultMessage;
    super(message, operation, { flag, ...details });
    this.name = 'ProhibitedFlagError';
  }
}