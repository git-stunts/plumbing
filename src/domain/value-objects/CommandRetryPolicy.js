/**
 * @fileoverview CommandRetryPolicy - Value object for retry logic configuration
 */

import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Encapsulates the strategy for retrying failed commands.
 */
export default class CommandRetryPolicy {
  /**
   * @param {Object} options
   * @param {number} [options.maxAttempts=3]
   * @param {number} [options.initialDelayMs=100]
   * @param {number} [options.backoffFactor=2]
   */
  constructor({ maxAttempts = 3, initialDelayMs = 100, backoffFactor = 2 } = {}) {
    if (maxAttempts < 1) {
      throw new InvalidArgumentError('maxAttempts must be at least 1', 'CommandRetryPolicy.constructor');
    }

    this.maxAttempts = maxAttempts;
    this.initialDelayMs = initialDelayMs;
    this.backoffFactor = backoffFactor;
  }

  /**
   * Calculates the delay for a given attempt.
   * @param {number} attempt - 1-based attempt number.
   * @returns {number} Delay in milliseconds.
   */
  getDelay(attempt) {
    if (attempt <= 1) {
      return 0;
    }
    return Math.pow(this.backoffFactor, attempt - 1) * this.initialDelayMs;
  }

  /**
   * Creates a default policy.
   * @returns {CommandRetryPolicy}
   */
  static default() {
    return new CommandRetryPolicy();
  }

  /**
   * Creates a policy with no retries.
   * @returns {CommandRetryPolicy}
   */
  static none() {
    return new CommandRetryPolicy({ maxAttempts: 1 });
  }

  /**
   * Returns a JSON representation.
   * @returns {Object}
   */
  toJSON() {
    return {
      maxAttempts: this.maxAttempts,
      initialDelayMs: this.initialDelayMs,
      backoffFactor: this.backoffFactor
    };
  }
}
