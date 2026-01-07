/**
 * @fileoverview GitTreeBuilder entity - provides efficient O(N) tree construction
 */

import GitTree from './GitTree.js';
import GitTreeEntry from './GitTreeEntry.js';
import GitFileMode from '../value-objects/GitFileMode.js';
import GitSha from '../value-objects/GitSha.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

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
      throw new InvalidArgumentError('Entry must be a GitTreeEntry instance', 'GitTreeBuilder.addEntry', { entry });
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
    const gitSha = sha instanceof GitSha ? sha : new GitSha(sha);
    const gitMode = mode instanceof GitFileMode ? mode : new GitFileMode(mode);
    
    return this.addEntry(new GitTreeEntry(gitMode, gitSha, path));
  }

  /**
   * Builds the GitTree
   * @returns {GitTree}
   */
  build() {
    return new GitTree(null, [...this._entries]);
  }
}
