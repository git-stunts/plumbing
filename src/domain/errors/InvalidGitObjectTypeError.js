/**
 * @fileoverview Custom error types for Git plumbing operations
 */

import GitPlumbingError from './GitPlumbingError.js';

/**
 * Error thrown when Git object type validation fails
 */
export default class InvalidGitObjectTypeError extends GitPlumbingError {
  constructor(type, operation) {
    super(`Invalid Git object type: ${type}`, operation, { type });
    this.name = 'InvalidGitObjectTypeError';
  }
}