/**
 * @fileoverview GitSignature value object - represents author/committer information
 */

import ValidationError from '../errors/ValidationError.js';

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
  constructor({ name, email, timestamp = Math.floor(Date.now() / 1000) }) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Name is required and must be a string', 'GitSignature.constructor', { name });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new ValidationError('Valid email is required', 'GitSignature.constructor', { email });
    }
    if (typeof timestamp !== 'number') {
      throw new ValidationError('Timestamp must be a number', 'GitSignature.constructor', { timestamp });
    }
    
    this.name = name;
    this.email = email;
    this.timestamp = timestamp;
  }

  /**
   * Returns the signature in Git format: "Name <email> timestamp"
   * @returns {string}
   */
  toString() {
    return `${this.name} <${this.email}> ${this.timestamp}`;
  }
}
