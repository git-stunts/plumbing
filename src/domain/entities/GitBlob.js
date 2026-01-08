/**
 * @fileoverview GitBlob entity - represents a Git blob object
 */

import GitSha from '../value-objects/GitSha.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import ByteMeasurer from '../services/ByteMeasurer.js';
import ValidationError from '../errors/ValidationError.js';
import { GitBlobSchema } from '../schemas/GitBlobSchema.js';

/**
 * Represents a Git blob object
 */
export default class GitBlob {
  /**
   * @param {GitSha|string|null} sha
   * @param {string|Uint8Array} content
   */
  constructor(sha, content) {
    const data = {
      sha: sha instanceof GitSha ? sha.toString() : sha,
      content
    };

    const result = GitBlobSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid blob: ${result.error.errors[0].message}`,
        'GitBlob.constructor',
        { data, errors: result.error.errors }
      );
    }

    this.sha = sha instanceof GitSha ? sha : (result.data.sha ? GitSha.from(result.data.sha) : null);
    this._content = result.data.content instanceof Uint8Array ? new Uint8Array(result.data.content) : result.data.content;
  }

  /**
   * Returns the blob content
   * @returns {string|Uint8Array}
   */
  get content() {
    return this._content instanceof Uint8Array ? new Uint8Array(this._content) : this._content;
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

  /**
   * Returns a JSON representation of the blob
   * @returns {Object}
   */
  toJSON() {
    return {
      sha: this.sha ? this.sha.toString() : null,
      content: this._content instanceof Uint8Array ? Array.from(this._content) : this._content
    };
  }
}
