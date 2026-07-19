import GitPlumbingError from './GitPlumbingError.js';

/**
 * Raised when a long-lived Git process violates its protocol contract.
 */
export default class GitProtocolError extends GitPlumbingError {
  /**
   * @param {string} message
   * @param {string} operation
   * @param {Object} [details]
   */
  constructor(message, operation, details = {}) {
    super(message, operation, { ...details, code: 'GIT_PROTOCOL_ERROR' });
    this.name = 'GitProtocolError';
  }
}
