import { describe, it, expect } from 'vitest';
import GitCommitBuilder from '../../../src/domain/entities/GitCommitBuilder.js';
import GitCommit from '../../../src/domain/entities/GitCommit.js';
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitSignature from '../../../src/domain/value-objects/GitSignature.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';

describe('GitCommitBuilder', () => {
  const tree = GitTree.empty();
  const author = new GitSignature({ name: 'James', email: 'james@example.com' });
  const message = 'Test message';

  it('builds a valid commit', () => {
    const commit = new GitCommitBuilder()
      .tree(tree)
      .author(author)
      .committer(author)
      .message(message)
      .build();
    
    expect(commit).toBeInstanceOf(GitCommit);
    expect(commit.message).toBe(message);
    expect(commit.tree).toBe(tree);
  });

  it('handles parents', () => {
    const p1 = 'a1b2c3d4e5f67890123456789012345678901234';
    const commit = new GitCommitBuilder()
      .tree(tree)
      .author(author)
      .committer(author)
      .parent(p1)
      .build();
    
    expect(commit.parents).toHaveLength(1);
    expect(commit.parents[0]).toBeInstanceOf(GitSha);
    expect(commit.parents[0].toString()).toBe(p1);
  });
});
