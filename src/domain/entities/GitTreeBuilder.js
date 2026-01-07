/**
 * @fileoverview GitTreeBuilder entity - provides efficient O(N) tree construction
 */

import GitTree from './GitTree.js';
import GitTreeEntry from './GitTreeEntry.js';
import ValidationError from '../errors/ValidationError.js';

/**
 * Fluent builder for creating GitTree instances efficiently
 */
export default class GitTreeBuilder {
  constructor() {
    this._entries = [];
  }

  /**
   * Adds an entry to the builder
   * @param {GitTreeEntry} entry
   * @returns {GitTreeBuilder}
   */
  addEntry(entry) {
    if (!(entry instanceof GitTreeEntry)) {
      throw new ValidationError('Entry must be a GitTreeEntry instance', 'GitTreeBuilder.addEntry', { entry });
    }
    this._entries.push(entry);
    return this;
  }

  /**
   * Convenience method to add an entry from primitives
   * @param {Object} options
   * @param {string} options.path
   * @param {GitSha|string} options.sha
   * @param {GitFileMode|string} options.mode
   * @returns {GitTreeBuilder}
   */
  add({ path, sha, mode }) {
    return this.addEntry(new GitTreeEntry({ mode, sha, path }));
  }

  /**
   * Builds the GitTree
   * @returns {GitTree}
   */
  build() {
    return new GitTree(null, [...this._entries]);
  }
}