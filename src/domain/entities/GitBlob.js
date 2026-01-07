/**
 * @fileoverview GitBlob entity - represents a Git blob object
 */

import GitSha from '../value-objects/GitSha.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import ByteMeasurer from '../services/ByteMeasurer.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Represents a Git blob object
 */
export default class GitBlob {
  /**
   * @param {GitSha|null} sha
   * @param {string|Uint8Array} content
   */
  constructor(sha, content) {
    if (sha && !(sha instanceof GitSha)) {
      throw new InvalidArgumentError('SHA must be a GitSha instance or null', 'GitBlob.constructor', { sha });
    }
    this.sha = sha;
    this.content = content;
  }

  /**
   * Creates a GitBlob from content
   * @param {string|Uint8Array} content
   * @returns {GitBlob}
   */
  static fromContent(content) {
    return new GitBlob(null, content);
  }

  /**
   * Checks if the blob has been written to the repository
   * @returns {boolean}
   */
  isWritten() {
    return this.sha !== null;
  }

  /**
   * Returns the content size in bytes
   * @returns {number}
   */
  size() {
    return ByteMeasurer.measure(this.content);
  }

  /**
   * Returns the blob type
   * @returns {GitObjectType}
   */
  type() {
    return GitObjectType.blob();
  }
}