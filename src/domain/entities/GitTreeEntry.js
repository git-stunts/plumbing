/**
 * @fileoverview GitTreeEntry entity - represents an entry in a Git tree
 */

import GitSha from '../value-objects/GitSha.js';
import GitFileMode from '../value-objects/GitFileMode.js';
import ValidationError from '../errors/ValidationError.js';
import { GitTreeEntrySchema } from '../schemas/GitTreeEntrySchema.js';

/**
 * @typedef {import('../schemas/GitTreeEntrySchema.js').GitTreeEntry} GitTreeEntryData
 */

/**
 * Represents an entry in a Git tree
 */
export default class GitTreeEntry {
  /**
   * @param {Object} options
   * @param {GitFileMode|string} options.mode - File mode
   * @param {GitSha|string} options.sha - Object SHA
   * @param {string} options.path - File path
   */
  constructor({ mode, sha, path }) {
    const data = {
      mode: mode instanceof GitFileMode ? mode.toString() : mode,
      sha: sha instanceof GitSha ? sha.toString() : sha,
      path
    };

    const result = GitTreeEntrySchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid tree entry: ${result.error.errors[0].message}`,
        'GitTreeEntry.constructor',
        { data, errors: result.error.errors }
      );
    }

    this.mode = mode instanceof GitFileMode ? mode : new GitFileMode(result.data.mode);
    this.sha = sha instanceof GitSha ? sha : new GitSha(result.data.sha);
    this.path = result.data.path;
  }

  /**
   * Returns the object type
   * @returns {import('../value-objects/GitObjectType.js').default}
   */
  type() {
    return this.mode.getObjectType();
  }

  /**
   * Returns if the entry is a directory (tree)
   * @returns {boolean}
   */
  isTree() {
    return this.mode.isTree();
  }

  /**
   * Returns if the entry is a blob
   * @returns {boolean}
   */
  isBlob() {
    return this.type().isBlob();
  }

  /**
   * Returns a JSON representation of the entry
   * @returns {GitTreeEntryData}
   */
  toJSON() {
    return {
      mode: this.mode.toString(),
      sha: this.sha.toString(),
      path: this.path
    };
  }
}