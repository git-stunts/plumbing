/**
 * @fileoverview GitTree entity - represents a Git tree object
 */

import GitSha from '../value-objects/GitSha.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import GitTreeEntry from './GitTreeEntry.js';
import ValidationError from '../errors/ValidationError.js';
import { GitTreeSchema } from '../schemas/GitTreeSchema.js';

/**
 * @typedef {import('../schemas/GitTreeSchema.js').GitTree} GitTreeData
 */

/**
 * Represents a Git tree object
 */
export default class GitTree {
  /**
   * @param {GitSha|string|null} sha - The tree SHA
   * @param {GitTreeEntry[]|Object[]} entries - Array of entries
   */
  constructor(sha = null, entries = []) {
    const data = {
      sha: sha instanceof GitSha ? sha.toString() : sha,
      entries: entries.map(e => (e instanceof GitTreeEntry ? e.toJSON() : e))
    };

    const result = GitTreeSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid tree data: ${result.error.errors[0].message}`,
        'GitTree.constructor',
        { data, errors: result.error.errors }
      );
    }

    this.sha = sha instanceof GitSha ? sha : (result.data.sha ? GitSha.from(result.data.sha) : null);
    this._entries = entries.map((e, i) => (e instanceof GitTreeEntry ? e : new GitTreeEntry(result.data.entries[i])));
  }

  /**
   * Factory method to create a GitTree from raw data with validation.
   * @param {GitTreeData} data
   * @returns {GitTree}
   */
  static fromData(data) {
    const result = GitTreeSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid tree data: ${result.error.errors[0].message}`,
        'GitTree.fromData',
        { data, errors: result.error.errors }
      );
    }

    const sha = result.data.sha ? GitSha.from(result.data.sha) : null;
    const entries = result.data.entries.map(e => new GitTreeEntry(e));
    return new GitTree(sha, entries);
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
   * Serializes the tree entries into the format expected by `git mktree`.
   * Format: <mode> <type> <sha>\t<path>
   * @returns {string}
   */
  toMktreeFormat() {
    return this._entries
      .map(entry => {
        const type = entry.isTree() ? 'tree' : 'blob';
        return `${entry.mode} ${type} ${entry.sha}\t${entry.path}`;
      })
      .join('\n') + '\n';
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
   * @returns {GitTreeData}
   */
  toJSON() {
    return {
      sha: this.sha ? this.sha.toString() : null,
      entries: this._entries.map(e => e.toJSON())
    };
  }
}