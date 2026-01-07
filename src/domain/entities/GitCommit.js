/**
 * @fileoverview GitCommit entity - represents a Git commit object
 */

import GitSha from '../value-objects/GitSha.js';
import GitTree from './GitTree.js';
import GitSignature from '../value-objects/GitSignature.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';

/**
 * Represents a Git commit object
 */
export default class GitCommit {
  /**
   * @param {GitSha|null} sha
   * @param {GitTree} tree
   * @param {GitSha[]} parents
   * @param {GitSignature} author
   * @param {GitSignature} committer
   * @param {string} message
   */
  constructor(sha, tree, parents, author, committer, message) {
    if (sha && !(sha instanceof GitSha)) {
      throw new InvalidArgumentError('SHA must be a GitSha instance or null', 'GitCommit.constructor', { sha });
    }
    if (!(tree instanceof GitTree)) {
      throw new InvalidArgumentError('Tree must be a GitTree instance', 'GitCommit.constructor', { tree });
    }
    if (!(author instanceof GitSignature)) {
      throw new InvalidArgumentError('Author must be a GitSignature instance', 'GitCommit.constructor', { author });
    }
    if (!(committer instanceof GitSignature)) {
      throw new InvalidArgumentError('Committer must be a GitSignature instance', 'GitCommit.constructor', { committer });
    }
    this.sha = sha;
    this.tree = tree;
    this.parents = parents;
    this.author = author;
    this.committer = committer;
    this.message = message;
  }

  /**
   * Checks if the commit has been written to the repository
   * @returns {boolean}
   */
  isWritten() {
    return this.sha !== null;
  }

  /**
   * Returns the commit type
   * @returns {GitObjectType}
   */
  type() {
    return GitObjectType.commit();
  }

  /**
   * Returns if this is a root commit (no parents)
   * @returns {boolean}
   */
  isRoot() {
    return this.parents.length === 0;
  }

  /**
   * Returns if this is a merge commit (multiple parents)
   * @returns {boolean}
   */
  isMerge() {
    return this.parents.length > 1;
  }
}
