/**
 * @fileoverview GitCommitBuilder entity - provides a fluent API for commit construction
 */

import GitCommit from './GitCommit.js';
import GitSha from '../value-objects/GitSha.js';
import GitSignature from '../value-objects/GitSignature.js';

/**
 * Fluent builder for creating GitCommit instances
 */
export default class GitCommitBuilder {
  constructor() {
    this._sha = null;
    this._treeSha = null;
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
    this._sha = sha instanceof GitSha ? sha : GitSha.from(sha);
    return this;
  }

  /**
   * Sets the tree SHA
   * @param {GitSha|string|{sha: GitSha|string}} tree
   * @returns {GitCommitBuilder}
   */
  tree(tree) {
    if (tree && typeof tree === 'object' && 'sha' in tree) {
      this._treeSha = tree.sha instanceof GitSha ? tree.sha : GitSha.from(tree.sha);
    } else {
      this._treeSha = tree instanceof GitSha ? tree : GitSha.from(tree);
    }
    return this;
  }

  /**
   * Adds a parent commit SHA
   * @param {GitSha|string} parentSha
   * @returns {GitCommitBuilder}
   */
  parent(parentSha) {
    const sha = parentSha instanceof GitSha ? parentSha : GitSha.from(parentSha);
    this._parents.push(sha);
    return this;
  }

  /**
   * Sets the parents array
   * @param {GitSha[]|string[]} parents
   * @returns {GitCommitBuilder}
   */
  parents(parents) {
    this._parents = parents.map(p => (p instanceof GitSha ? p : GitSha.from(p)));
    return this;
  }

  /**
   * Sets the author
   * @param {GitSignature|Object} author
   * @returns {GitCommitBuilder}
   */
  author(author) {
    this._author = author instanceof GitSignature ? author : new GitSignature(author);
    return this;
  }

  /**
   * Sets the committer
   * @param {GitSignature|Object} committer
   * @returns {GitCommitBuilder}
   */
  committer(committer) {
    this._committer = committer instanceof GitSignature ? committer : new GitSignature(committer);
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
    return new GitCommit({
      sha: this._sha,
      treeSha: this._treeSha,
      parents: this._parents,
      author: this._author,
      committer: this._committer,
      message: this._message
    });
  }
}
