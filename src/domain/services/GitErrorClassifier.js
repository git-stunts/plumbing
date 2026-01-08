/**
 * @fileoverview GitErrorClassifier - Domain service for categorizing Git errors
 */

import GitPlumbingError from '../errors/GitPlumbingError.js';
import GitRepositoryLockedError from '../errors/GitRepositoryLockedError.js';

/**
 * Classifies Git errors based on exit codes and stderr patterns.
 */
export default class GitErrorClassifier {
  /**
   * @param {Object} [options]
   * @param {Array<{test: function(number, string): boolean, create: function(Object): Error}>} [options.customRules=[]]
   */
  constructor({ customRules = [] } = {}) {
    /** @private */
    this.customRules = customRules;
  }

  /**
   * Classifies a Git command failure.
   * @param {Object} options
   * @param {number} options.code
   * @param {string} options.stderr
   * @param {string[]} options.args
   * @param {string} [options.stdout]
   * @param {string} options.traceId
   * @param {number} options.latency
   * @param {string} options.operation
   * @returns {GitPlumbingError}
   */
  classify({ code, stderr, args, stdout, traceId, latency, operation }) {
    // 1. Check custom rules first
    for (const rule of this.customRules) {
      if (rule.test(code, stderr)) {
        return rule.create({ code, stderr, args, stdout, traceId, latency, operation });
      }
    }

    // 2. Check for lock contention (Exit code 128 indicates state/lock issues)
    // Use regex for more robust detection of lock files (index.lock or other .lock files)
    const lockRegex = /\w+\.lock/;
    const isLocked = code === 128 && (lockRegex.test(stderr) || stderr.includes('lock'));

    if (isLocked) {
      return new GitRepositoryLockedError(`Git command failed: repository is locked`, operation, {
        args,
        stderr,
        code,
        traceId,
        latency
      });
    }

    return new GitPlumbingError(`Git command failed with code ${code}`, operation, {
      args,
      stderr,
      stdout,
      code,
      traceId,
      latency
    });
  }

  /**
   * Checks if an error is retryable (e.g., lock contention).
   * @param {Error} err
   * @returns {boolean}
   */
  isRetryable(err) {
    return err instanceof GitRepositoryLockedError;
  }
}