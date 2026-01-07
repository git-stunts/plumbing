/**
 * @fileoverview GitSignature value object - represents author/committer information
 */

import ValidationError from '../errors/ValidationError.js';
import { GitSignatureSchema } from '../schemas/GitSignatureSchema.js';

/**
 * Represents a Git signature (author or committer)
 */
export default class GitSignature {
  /**
   * @param {Object} data
   * @param {string} data.name - Name of the person
   * @param {string} data.email - Email of the person
   * @param {number} [data.timestamp] - Unix timestamp (seconds)
   */
  constructor(data) {
    const result = GitSignatureSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid signature: ${result.error.errors[0].message}`,
        'GitSignature.constructor',
        { data, errors: result.error.errors }
      );
    }
    
    this.name = result.data.name;
    this.email = result.data.email;
    this.timestamp = result.data.timestamp;
  }

  /**
   * Returns the signature in Git format: "Name <email> timestamp"
   * @returns {string}
   */
  toString() {
    return `${this.name} <${this.email}> ${this.timestamp}`;
  }

  /**
   * Returns the JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      email: this.email,
      timestamp: this.timestamp
    };
  }
}
