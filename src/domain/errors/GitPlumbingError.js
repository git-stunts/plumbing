/**
 * @fileoverview Custom error types for Git plumbing operations
 */

/**
 * Base error for Git operations
 */
export default class GitPlumbingError extends Error {
  constructor(message, operation, details = {}) {
    super(message);
    this.name = 'GitPlumbingError';
    this.operation = operation;
    this.details = details;
  }
}