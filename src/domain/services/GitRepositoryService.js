/**
 * @fileoverview GitRepositoryService - High-level domain service for repository operations
 */

import GitSha from '../value-objects/GitSha.js';
import GitCommandBuilder from './GitCommandBuilder.js';
import GitPersistenceService from './GitPersistenceService.js';
import GitBlob from '../entities/GitBlob.js';
import GitTree from '../entities/GitTree.js';
import GitTreeEntry from '../entities/GitTreeEntry.js';
import GitCommit from '../entities/GitCommit.js';

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
   * Orchestrates a full commit sequence from files and metadata.
   * Uses a concurrency limit to prevent resource exhaustion during blob creation.
   * @param {Object} options
   * @param {string} options.branch - The reference to update (e.g., 'refs/heads/main')
   * @param {string} options.message - Commit message
   * @param {import('../value-objects/GitSignature.js').default} options.author
   * @param {import('../value-objects/GitSignature.js').default} options.committer
   * @param {import('../value-objects/GitSha.js').default[]} options.parents
   * @param {Array<{path: string, content: string|Uint8Array, mode: string}>} options.files
   * @param {number} [options.concurrency=10] - Max parallel blob write operations.
   * @returns {Promise<GitSha>} The resulting commit SHA.
   */
  async createCommitFromFiles({ 
    branch, 
    message, 
    author, 
    committer, 
    parents, 
    files, 
    concurrency = 10 
  }) {
    const entries = [];
    const remainingFiles = [...files];
    
    // Concurrency limit for writing blobs
    const processBatch = async () => {
      const batch = remainingFiles.splice(0, concurrency);
      if (batch.length === 0) {return;}

      const batchResults = await Promise.all(batch.map(async (file) => {
        const blob = GitBlob.fromContent(file.content);
        const sha = await this.writeBlob(blob);
        return new GitTreeEntry({
          path: file.path,
          sha,
          mode: file.mode || '100644'
        });
      }));

      entries.push(...batchResults);
      await processBatch();
    };

    await processBatch();

    // 2. Write Tree
    const tree = new GitTree(null, entries);
    const treeSha = await this.writeTree(tree);

    // 3. Write Commit
    const commit = new GitCommit({
      sha: null,
      treeSha,
      parents,
      author,
      committer,
      message
    });
    const commitSha = await this.writeCommit(commit);

    // 4. Update Reference
    if (branch) {
      await this.updateRef({ ref: branch, newSha: commitSha });
    }

    return commitSha;
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
    const gitNewSha = newSha instanceof GitSha ? newSha : GitSha.from(newSha);
    const gitOldSha = oldSha ? (oldSha instanceof GitSha ? oldSha : GitSha.from(oldSha)) : null;

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