/**
 * @fileoverview GitBinaryChecker - Domain service for verifying Git availability
 */

import GitPlumbingError from '../errors/GitPlumbingError.js';

/**
 * Service to verify that the Git binary is installed and functional.
 */
export default class GitBinaryChecker {
  /**
   * @param {Object} options
   * @param {import('../../../index.js').default} options.plumbing - The plumbing service for execution.
   */
  constructor({ plumbing }) {
    /** @private */
    this.plumbing = plumbing;
  }

  /**
   * Verifies that the git binary is available.
   * @returns {Promise<boolean>}
   * @throws {GitPlumbingError}
   */
  async check() {
    try {
      // Check binary availability by calling --version
      await this.plumbing.execute({ args: ['--version'] });
      return true;
    } catch (err) {
      throw new GitPlumbingError(
        `Git binary verification failed: ${err.message}`, 
        'GitBinaryChecker.check', 
        { originalError: err.message, code: 'GIT_BINARY_NOT_FOUND' }
      );
    }
  }

  /**
   * Checks if the current working directory is inside a Git repository.
   * @returns {Promise<boolean>}
   * @throws {GitPlumbingError}
   */
  async isInsideWorkTree() {
    try {
      const isInside = await this.plumbing.execute({ args: ['rev-parse', '--is-inside-work-tree'] });
      return isInside === 'true';
    } catch (err) {
      throw new GitPlumbingError(
        `Git repository verification failed: ${err.message}`, 
        'GitBinaryChecker.isInsideWorkTree', 
        { originalError: err.message, code: 'GIT_NOT_IN_REPO' }
      );
    }
  }
}
