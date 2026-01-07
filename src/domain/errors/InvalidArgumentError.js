/**
 * @fileoverview Custom error for invalid arguments
 */

import GitPlumbingError from './GitPlumbingError.js';

/**
 * Error thrown when an argument passed to a function is invalid
 */
export default class InvalidArgumentError extends GitPlumbingError {
  /**
   * @param {string} message
   * @param {string} operation
   * @param {Object} [details={}]
   */
  constructor(message, operation, details = {}) {
    super(message, operation, details);
    this.name = 'InvalidArgumentError';
  }
}
