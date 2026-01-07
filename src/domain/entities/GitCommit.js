/**
 * @fileoverview GitCommit entity - represents a Git commit object
 */

import GitSha from '../value-objects/GitSha.js';
import GitSignature from '../value-objects/GitSignature.js';
import GitObjectType from '../value-objects/GitObjectType.js';
import ValidationError from '../errors/ValidationError.js';
import { GitCommitSchema } from '../schemas/GitCommitSchema.js';

/**
 * Represents a Git commit object
 */
export default class GitCommit {
  /**
   * @param {Object} options
   * @param {GitSha|string|null} options.sha
   * @param {GitSha|string} options.treeSha
   * @param {GitSha[]|string[]} options.parents
   * @param {GitSignature|Object} options.author
   * @param {GitSignature|Object} options.committer
   * @param {string} options.message
   */
  constructor({ sha, treeSha, parents, author, committer, message }) {
    const data = {
      sha: sha instanceof GitSha ? sha.toString() : sha,
      treeSha: treeSha instanceof GitSha ? treeSha.toString() : treeSha,
      parents: parents.map(p => (p instanceof GitSha ? p.toString() : p)),
      author: author instanceof GitSignature ? author.toJSON() : author,
      committer: committer instanceof GitSignature ? committer.toJSON() : committer,
      message
    };

    const result = GitCommitSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        `Invalid commit: ${result.error.errors[0].message}`,
        'GitCommit.constructor',
        { data, errors: result.error.errors }
      );
    }

    this.sha = sha instanceof GitSha ? sha : (result.data.sha ? new GitSha(result.data.sha) : null);
    this.treeSha = new GitSha(result.data.treeSha);
    this.parents = result.data.parents.map(p => new GitSha(p));
    this.author = author instanceof GitSignature ? author : new GitSignature(result.data.author);
    this.committer = committer instanceof GitSignature ? committer : new GitSignature(result.data.committer);
    this.message = result.data.message;
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
   * @returns {Object}
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