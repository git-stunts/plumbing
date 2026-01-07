/**
 * @fileoverview GitTreeEntry entity - represents an entry in a Git tree
 */

import GitSha from '../value-objects/GitSha.js';
import GitFileMode from '../value-objects/GitFileMode.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Represents an entry in a Git tree
 */
export default class GitTreeEntry {
  /**
   * @param {GitFileMode} mode - File mode
   * @param {GitSha} sha - Object SHA
   * @param {string} path - File path
   */
  constructor(mode, sha, path) {
    if (!(mode instanceof GitFileMode)) {
      throw new InvalidArgumentError('Mode must be a GitFileMode instance', 'GitTreeEntry.constructor', { mode });
    }
    if (!(sha instanceof GitSha)) {
      throw new InvalidArgumentError('SHA must be a GitSha instance', 'GitTreeEntry.constructor', { sha });
    }
    this.mode = mode;
    this.sha = sha;
    this.path = path;
  }

  /**
   * Returns the object type
   * @returns {GitObjectType}
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
}