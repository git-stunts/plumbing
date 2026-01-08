/**
 * @fileoverview GitCommit entity - represents a Git commit object
 */

import GitSha from '../value-objects/GitSha.js';
import GitSignature from '../value-objects/GitSignature.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import ValidationError from '../errors/ValidationError.js';
import { GitCommitSchema } from '../schemas/GitCommitSchema.js';

/**
 * @typedef {import('../schemas/GitCommitSchema.js').GitCommit} GitCommitData
 */

/**
 * Represents a Git commit object
 */
export default class GitCommit {
  /**
   * @param {Object} options
   * @param {GitSha|null} options.sha
   * @param {GitSha} options.treeSha
   * @param {GitSha[]} options.parents
   * @param {GitSignature} options.author
   * @param {GitSignature} options.committer
   * @param {string} options.message
   */
  constructor({ sha, treeSha, parents = [], author, committer, message }) {
    if (sha !== null && !(sha instanceof GitSha)) {
      throw new ValidationError('SHA must be a GitSha instance or null', 'GitCommit.constructor');
    }
    if (!(treeSha instanceof GitSha)) {
      throw new ValidationError('treeSha must be a GitSha instance', 'GitCommit.constructor');
    }
    if (!Array.isArray(parents)) {
      throw new ValidationError('parents must be an array of GitSha', 'GitCommit.constructor');
    }
    for (const parent of parents) {
      if (!(parent instanceof GitSha)) {
        throw new ValidationError('parents must be an array of GitSha', 'GitCommit.constructor');
      }
    }
    if (!(author instanceof GitSignature)) {
      throw new ValidationError('author must be a GitSignature instance', 'GitCommit.constructor');
    }
    if (!(committer instanceof GitSignature)) {
      throw new ValidationError('committer must be a GitSignature instance', 'GitCommit.constructor');
    }
    if (typeof message !== 'string') {
      throw new ValidationError('message must be a string', 'GitCommit.constructor');
    }

    this.sha = sha;
    this.treeSha = treeSha;
    this.parents = [...parents];
    this.author = author;
    this.committer = committer;
    this.message = message;
  }

  /**
   * Factory method to create a GitCommit from raw data with validation.
   * @param {GitCommitData} data
   * @returns {GitCommit}
   */
  static fromData(data) {
    const result = GitCommitSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid commit data: ${result.error.errors[0].message}`,
        'GitCommit.fromData',
        { data, errors: result.error.errors }
      );
    }

    return new GitCommit({
      sha: result.data.sha ? GitSha.from(result.data.sha) : null,
      treeSha: GitSha.from(result.data.treeSha),
      parents: result.data.parents.map(p => GitSha.from(p)),
      author: new GitSignature(result.data.author),
      committer: new GitSignature(result.data.committer),
      message: result.data.message
    });
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

  /**
   * Returns a JSON representation of the commit
   * @returns {GitCommitData}
   */
  toJSON() {
    return {
      sha: this.sha ? this.sha.toString() : null,
      treeSha: this.treeSha.toString(),
      parents: this.parents.map(p => p.toString()),
      author: this.author.toJSON(),
      committer: this.committer.toJSON(),
      message: this.message
    };
  }
}
