/**
 * @fileoverview Custom error for validation failures
 */

import GitPlumbingError from './GitPlumbingError.js';

/**
 * Error thrown when validation fails
 */
export default class ValidationError extends GitPlumbingError {
  /**
   * @param {string} message
   * @param {string} operation
   * @param {Object} [details={}]
   */
  constructor(message, operation, details = {}) {
    super(message, operation, details);
    this.name = 'ValidationError';
  }
}
