import GitPlumbingError from './GitPlumbingError.js';

/**
 * Raised when an injected adapter does not implement an optional capability.
 */
export default class UnsupportedCapabilityError extends GitPlumbingError {
  /**
   * @param {string} capability
   * @param {string} operation
   * @param {Object} [details]
   */
  constructor(capability, operation, details = {}) {
    super(`Runner does not support ${capability}`, operation, {
      ...details,
      capability,
      code: 'UNSUPPORTED_CAPABILITY',
    });
    this.name = 'UnsupportedCapabilityError';
  }
}
