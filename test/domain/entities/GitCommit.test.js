
import GitCommit from '../../../src/domain/entities/GitCommit.js';
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitSignature from '../../../src/domain/value-objects/GitSignature.js';
import InvalidArgumentError from '../../../src/domain/errors/InvalidArgumentError.js';

describe('GitCommit', () => {
  const tree = GitTree.empty();
  const signature = new GitSignature({ name: 'James', email: 'james@example.com', timestamp: 1234567890 });
  const author = signature;
  const committer = signature;
  const message = 'Initial commit';

  describe('constructor', () => {
    it('creates a root commit', () => {
      const commit = new GitCommit(null, tree, [], author, committer, message);
      expect(commit.isRoot()).toBe(true);
      expect(commit.isMerge()).toBe(false);
      expect(commit.parents).toHaveLength(0);
    });

    it('creates a commit with parents', () => {
      const parent = GitSha.fromString('a1b2c3d4e5f67890123456789012345678901234');
      const commit = new GitCommit(null, tree, [parent], author, committer, message);
      expect(commit.isRoot()).toBe(false);
      expect(commit.parents).toHaveLength(1);
    });

    it('creates a merge commit', () => {
      const p1 = GitSha.fromString('a1b2c3d4e5f67890123456789012345678901234');
      const p2 = GitSha.fromString('f1e2d3c4b5a697887766554433221100ffeeddcc');
      const commit = new GitCommit(null, tree, [p1, p2], author, committer, message);
      expect(commit.isMerge()).toBe(true);
      expect(commit.parents).toHaveLength(2);
    });

    it('throws for invalid tree', () => {
      expect(() => new GitCommit(null, {}, [], author, committer, message)).toThrow(InvalidArgumentError);
    });
  });

  describe('type', () => {
    it('returns commit type', () => {
      const commit = new GitCommit(null, tree, [], author, committer, message);
      expect(commit.type().isCommit()).toBe(true);
    });
  });
});
