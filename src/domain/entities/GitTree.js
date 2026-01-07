/**
 * @fileoverview GitTree entity - represents a Git tree object
 */

import GitSha from '../value-objects/GitSha.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import GitTreeEntry from './GitTreeEntry.js';
import ValidationError from '../errors/ValidationError.js';
import { GitTreeSchema } from '../schemas/GitTreeSchema.js';

/**
 * Represents a Git tree object
 */
export default class GitTree {
  /**
   * @param {GitSha|string|null} sha
   * @param {GitTreeEntry[]} entries
   */
  constructor(sha, entries = []) {
    const data = {
      sha: sha instanceof GitSha ? sha.toString() : sha,
      entries: entries.map(e => (e instanceof GitTreeEntry ? e.toJSON() : e))
    };

    const result = GitTreeSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid tree: ${result.error.errors[0].message}`,
        'GitTree.constructor',
        { data, errors: result.error.errors }
      );
    }

    this.sha = sha instanceof GitSha ? sha : (result.data.sha ? new GitSha(result.data.sha) : null);
    this._entries = entries.map((e, i) => {
      if (e instanceof GitTreeEntry) return e;
      const d = result.data.entries[i];
      return new GitTreeEntry(d.mode, d.sha, d.path);
    });
  }

  /**
   * Returns a copy of the tree entries
   * @returns {GitTreeEntry[]}
   */
  get entries() {
    return [...this._entries];
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
      throw new ValidationError('Entry must be a GitTreeEntry instance', 'GitTree.addEntry', { entry });
    }
    return new GitTree(this.sha, [...this._entries, entry]);
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

  /**
   * Returns a JSON representation of the tree
   * @returns {Object}
   */
  toJSON() {
    return {
      sha: this.sha ? this.sha.toString() : null,
      entries: this._entries.map(e => e.toJSON())
    };
  }
}