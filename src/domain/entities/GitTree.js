/**
 * @fileoverview GitTree entity - represents a Git tree object
 */

import GitSha from '../value-objects/GitSha.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import GitTreeEntry from './GitTreeEntry.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Represents a Git tree object
 */
export default class GitTree {
  /**
   * @param {GitSha|null} sha
   * @param {GitTreeEntry[]} entries
   */
  constructor(sha, entries = []) {
    if (sha && !(sha instanceof GitSha)) {
      throw new InvalidArgumentError('SHA must be a GitSha instance or null', 'GitTree.constructor', { sha });
    }
    this.sha = sha;
    this.entries = entries;
  }

  /**
   * Creates an empty GitTree
   * @returns {GitTree}
   */
  static empty() {
    return new GitTree(GitSha.EMPTY_TREE, []);
  }

  /**
   * Adds an entry to the tree
   * @param {GitTreeEntry} entry
   * @returns {GitTree}
   */
  addEntry(entry) {
    if (!(entry instanceof GitTreeEntry)) {
      throw new InvalidArgumentError('Entry must be a GitTreeEntry instance', 'GitTree.addEntry', { entry });
    }
    return new GitTree(this.sha, [...this.entries, entry]);
  }

  /**
   * Checks if the tree has been written to the repository
   * @returns {boolean}
   */
  isWritten() {
    return this.sha !== null;
  }

  /**
   * Returns the tree type
   * @returns {GitObjectType}
   */
  type() {
    return GitObjectType.tree();
  }
}
