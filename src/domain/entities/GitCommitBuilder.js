/**
 * @fileoverview GitCommitBuilder entity - provides a fluent API for commit construction
 */

import GitCommit from './GitCommit.js';
import GitSha from '../value-objects/GitSha.js';
import GitTree from './GitTree.js';
import GitSignature from '../value-objects/GitSignature.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Fluent builder for creating GitCommit instances
 */
export default class GitCommitBuilder {
  constructor() {
    this._sha = null;
    this._tree = null;
    this._parents = [];
    this._author = null;
    this._committer = null;
    this._message = '';
  }

  /**
   * Sets the commit SHA
   * @param {GitSha|string|null} sha
   * @returns {GitCommitBuilder}
   */
  sha(sha) {
    if (sha === null) {
      this._sha = null;
      return this;
    }
    this._sha = sha instanceof GitSha ? sha : new GitSha(sha);
    return this;
  }

  /**
   * Sets the tree
   * @param {GitTree} tree
   * @returns {GitCommitBuilder}
   */
  tree(tree) {
    if (!(tree instanceof GitTree)) {
      throw new InvalidArgumentError('Tree must be a GitTree instance', 'GitCommitBuilder.tree', { tree });
    }
    this._tree = tree;
    return this;
  }

  /**
   * Adds a parent commit SHA
   * @param {GitSha|string} parentSha
   * @returns {GitCommitBuilder}
   */
  parent(parentSha) {
    const sha = parentSha instanceof GitSha ? parentSha : new GitSha(parentSha);
    this._parents.push(sha);
    return this;
  }

  /**
   * Sets the parents array
   * @param {GitSha[]|string[]} parents
   * @returns {GitCommitBuilder}
   */
  parents(parents) {
    if (!Array.isArray(parents)) {
      throw new InvalidArgumentError('Parents must be an array', 'GitCommitBuilder.parents');
    }
    this._parents = parents.map(p => (p instanceof GitSha ? p : new GitSha(p)));
    return this;
  }

  /**
   * Sets the author
   * @param {GitSignature} author
   * @returns {GitCommitBuilder}
   */
  author(author) {
    if (!(author instanceof GitSignature)) {
      throw new InvalidArgumentError('Author must be a GitSignature instance', 'GitCommitBuilder.author', { author });
    }
    this._author = author;
    return this;
  }

  /**
   * Sets the committer
   * @param {GitSignature} committer
   * @returns {GitCommitBuilder}
   */
  committer(committer) {
    if (!(committer instanceof GitSignature)) {
      throw new InvalidArgumentError('Committer must be a GitSignature instance', 'GitCommitBuilder.committer', { committer });
    }
    this._committer = committer;
    return this;
  }

  /**
   * Sets the commit message
   * @param {string} message
   * @returns {GitCommitBuilder}
   */
  message(message) {
    this._message = String(message);
    return this;
  }

  /**
   * Builds the GitCommit
   * @returns {GitCommit}
   */
  build() {
    if (!this._tree) {
      throw new InvalidArgumentError('Tree is required to build a commit', 'GitCommitBuilder.build');
    }
    if (!this._author) {
      throw new InvalidArgumentError('Author is required to build a commit', 'GitCommitBuilder.build');
    }
    if (!this._committer) {
      throw new InvalidArgumentError('Committer is required to build a commit', 'GitCommitBuilder.build');
    }

    return new GitCommit({
      sha: this._sha,
      tree: this._tree,
      parents: this._parents,
      author: this._author,
      committer: this._committer,
      message: this._message
    });
  }
}
