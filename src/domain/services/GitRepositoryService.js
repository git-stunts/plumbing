/**
 * @fileoverview GitRepositoryService - High-level domain service for repository operations
 */

import GitSha from '../value-objects/GitSha.js';
import GitCommandBuilder from './GitCommandBuilder.js';
import GitPersistenceService from './GitPersistenceService.js';

/**
 * GitRepositoryService provides high-level operations on a Git repository.
 * It uses a CommandRunner port via GitPlumbing to execute commands.
 */
export default class GitRepositoryService {
  /**
   * @param {Object} options
   * @param {import('../../../index.js').default} options.plumbing - The plumbing service for execution.
   * @param {GitPersistenceService} [options.persistence] - Injected persistence service.
   */
  constructor({ plumbing, persistence = new GitPersistenceService({ plumbing }) }) {
    this.plumbing = plumbing;
    this.persistence = persistence;
  }

  /**
   * Persists any Git entity (Blob, Tree, or Commit) and returns its SHA.
   * @param {import('../entities/GitBlob.js').default|import('../entities/GitTree.js').default|import('../entities/GitCommit.js').default} entity
   * @returns {Promise<import('../value-objects/GitSha.js').default>}
   */
  async save(entity) {
    return await this.persistence.persist(entity);
  }

  /**
   * Persists a blob.
   * @param {import('../entities/GitBlob.js').default} blob
   * @returns {Promise<GitSha>}
   */
  async writeBlob(blob) {
    return await this.persistence.writeBlob(blob);
  }

  /**
   * Persists a tree.
   * @param {import('../entities/GitTree.js').default} tree
   * @returns {Promise<GitSha>}
   */
  async writeTree(tree) {
    return await this.persistence.writeTree(tree);
  }

  /**
   * Persists a commit.
   * @param {import('../entities/GitCommit.js').default} commit
   * @returns {Promise<GitSha>}
   */
  async writeCommit(commit) {
    return await this.persistence.writeCommit(commit);
  }

  /**
   * Resolves a revision to a full SHA.
   * @param {Object} options
   * @param {string} options.revision
   * @returns {Promise<string>}
   */
  async revParse({ revision }) {
    const args = GitCommandBuilder.revParse().arg(revision).build();
    return await this.plumbing.execute({ args });
  }

  /**
   * Updates a reference to point to a new SHA.
   * @param {Object} options
   * @param {string} options.ref
   * @param {import('../value-objects/GitSha.js').default|string} options.newSha
   * @param {import('../value-objects/GitSha.js').default|string} [options.oldSha]
   */
  async updateRef({ ref, newSha, oldSha }) {
    const gitNewSha = newSha instanceof GitSha ? newSha : new GitSha(newSha);
    const gitOldSha = oldSha ? (oldSha instanceof GitSha ? oldSha : new GitSha(oldSha)) : null;

    const args = GitCommandBuilder.updateRef()
      .arg(ref)
      .arg(gitNewSha.toString())
      .arg(gitOldSha ? gitOldSha.toString() : null)
      .build();
    await this.plumbing.execute({ args });
  }

  /**
   * Deletes a reference.
   * @param {Object} options
   * @param {string} options.ref
   */
  async deleteRef({ ref }) {
    const args = GitCommandBuilder.updateRef().delete().arg(ref).build();
    await this.plumbing.execute({ args });
  }
}
