/**
 * @fileoverview GitRepositoryLockedError - Thrown when a git lock file exists
 */

import GitPlumbingError from './GitPlumbingError.js';

/**
 * Error thrown when a Git operation fails because the repository is locked.
 */
export default class GitRepositoryLockedError extends GitPlumbingError {
  /**
   * @param {string} message
   * @param {string} operation
   * @param {Object} [details={}]
   */
  constructor(message, operation, details = {}) {
    super(message, operation, {
      ...details,
      code: 'GIT_REPOSITORY_LOCKED',
      remediation: 'Another git process is running. If no other process is active, delete .git/index.lock to proceed.',
      documentation: 'https://github.com/git-stunts/plumbing/blob/main/docs/RECIPES.md#handling-repository-locks'
    });
    this.name = 'GitRepositoryLockedError';
  }
}