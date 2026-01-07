import { describe, it, expect } from 'vitest';
import GitCommitBuilder from '../../../src/domain/entities/GitCommitBuilder.js';
import GitCommit from '../../../src/domain/entities/GitCommit.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitSignature from '../../../src/domain/value-objects/GitSignature.js';

describe('GitCommitBuilder', () => {
  const tree = GitTree.empty();
  const author = new GitSignature({ name: 'Author', email: 'author@example.com' });
  const committer = new GitSignature({ name: 'Committer', email: 'committer@example.com' });
  const message = 'Test message';

  it('builds a valid commit', () => {
    const builder = new GitCommitBuilder();
    const commit = builder
      .tree(tree)
      .author(author)
      .committer(committer)
      .message(message)
      .build();

    expect(commit).toBeInstanceOf(GitCommit);
    expect(commit.message).toBe(message);
    expect(commit.treeSha.equals(tree.sha)).toBe(true);
  });

  it('handles parents', () => {
    const parent1 = '1234567890abcdef1234567890abcdef12345678';
    const parent2 = new GitSha('abcdef1234567890abcdef1234567890abcdef12');
    
    const builder = new GitCommitBuilder();
    const commit = builder
      .tree(tree)
      .author(author)
      .committer(committer)
      .parent(parent1)
      .parent(parent2)
      .build();

    expect(commit.parents).toHaveLength(2);
    expect(commit.parents[0].toString()).toBe(parent1);
    expect(commit.parents[1].equals(parent2)).toBe(true);
  });
});