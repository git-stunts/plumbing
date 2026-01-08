/**
 * @fileoverview GitPersistenceService - Domain service for Git object persistence
 */

import GitSha from '../value-objects/GitSha.js';
import GitCommandBuilder from './GitCommandBuilder.js';
import GitBlob from '../entities/GitBlob.js';
import GitTree from '../entities/GitTree.js';
import GitCommit from '../entities/GitCommit.js';
import InvalidArgumentError from '../errors/InvalidArgumentError.js';
import EnvironmentPolicy from './EnvironmentPolicy.js';

/**
 * GitPersistenceService implements the persistence logic for Git entities.
 */
export default class GitPersistenceService {
  /**
   * @param {Object} options
   * @param {import('../../../index.js').default} options.plumbing - The plumbing service for execution.
   */
  constructor({ plumbing }) {
    this.plumbing = plumbing;
  }

  /**
   * Persists a Git entity (Blob, Tree, or Commit).
   * @param {GitBlob|GitTree|GitCommit} entity
   * @returns {Promise<GitSha>}
   */
  async persist(entity) {
    if (entity instanceof GitBlob) {
      return await this.writeBlob(entity);
    } else if (entity instanceof GitTree) {
      return await this.writeTree(entity);
    } else if (entity instanceof GitCommit) {
      return await this.writeCommit(entity);
    }
    throw new InvalidArgumentError('Unsupported entity type for persistence', 'GitPersistenceService.persist');
  }

  /**
   * Persists a GitBlob to the object database.
   * @param {GitBlob} blob
   * @returns {Promise<GitSha>}
   */
  async writeBlob(blob) {
    if (!(blob instanceof GitBlob)) {
      throw new InvalidArgumentError('Expected instance of GitBlob', 'GitPersistenceService.writeBlob');
    }

    const args = GitCommandBuilder.hashObject()
      .write()
      .stdin()
      .build();

    const shaStr = await this.plumbing.execute({
      args,
      input: blob.content
    });

    return GitSha.from(shaStr.trim());
  }

  /**
   * Persists a GitTree to the object database.
   * @param {GitTree} tree
   * @returns {Promise<GitSha>}
   */
  async writeTree(tree) {
    if (!(tree instanceof GitTree)) {
      throw new InvalidArgumentError('Expected instance of GitTree', 'GitPersistenceService.writeTree');
    }

    const input = tree.toMktreeFormat();
    const args = GitCommandBuilder.mktree().build();

    const shaStr = await this.plumbing.execute({
      args,
      input
    });

    return GitSha.from(shaStr.trim());
  }

  /**
   * Persists a GitCommit to the object database.
   * @param {GitCommit} commit
   * @returns {Promise<GitSha>}
   */
  async writeCommit(commit) {
    if (!(commit instanceof GitCommit)) {
      throw new InvalidArgumentError('Expected instance of GitCommit', 'GitPersistenceService.writeCommit');
    }

    const builder = GitCommandBuilder.commitTree()
      .arg(commit.treeSha.toString());

    for (const parent of commit.parents) {
      builder.parent(parent.toString());
    }

    builder.message(commit.message);

    const args = builder.build();

    // Ensure environment is filtered through policy
    const env = EnvironmentPolicy.filter({
      GIT_AUTHOR_NAME: commit.author.name,
      GIT_AUTHOR_EMAIL: commit.author.email,
      GIT_AUTHOR_DATE: commit.author.timestamp.toString(),
      GIT_COMMITTER_NAME: commit.committer.name,
      GIT_COMMITTER_EMAIL: commit.committer.email,
      GIT_COMMITTER_DATE: commit.committer.timestamp.toString()
    });
    
    const shaStr = await this.plumbing.execute({ args, env });

    return GitSha.from(shaStr.trim());
  }
}
