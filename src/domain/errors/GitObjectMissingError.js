import GitPlumbingError from './GitPlumbingError.js';

/**
 * Raised when Git reports that a requested object does not exist.
 */
export default class GitObjectMissingError extends GitPlumbingError {
  /**
   * @param {string} objectName
   * @param {string} operation
   * @param {Object} [details]
   */
  constructor(objectName, operation, details = {}) {
    super(`Git object is missing: ${objectName}`, operation, {
      ...details,
      code: 'GIT_OBJECT_MISSING',
      objectName,
    });
    this.name = 'GitObjectMissingError';
  }
}
