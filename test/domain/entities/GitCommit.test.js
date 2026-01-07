import GitCommit from '../../../src/domain/entities/GitCommit.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitSignature from '../../../src/domain/value-objects/GitSignature.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';

describe('GitCommit', () => {
  const treeSha = GitSha.EMPTY_TREE;
  const author = new GitSignature({ name: 'Author', email: 'author@example.com', timestamp: 1234567890 });
  const committer = new GitSignature({ name: 'Committer', email: 'committer@example.com', timestamp: 1234567890 });
  const message = 'Initial commit';

  describe('constructor', () => {
    it('creates a root commit', () => {
      const commit = new GitCommit({ sha: null, treeSha, parents: [], author, committer, message });
      expect(commit.sha).toBeNull();
      expect(commit.treeSha.equals(treeSha)).toBe(true);
      expect(commit.parents).toHaveLength(0);
      expect(commit.isRoot()).toBe(true);
    });

    it('creates a commit with parents', () => {
      const parent = GitSha.from('1234567890abcdef1234567890abcdef12345678');
      const commit = new GitCommit({ sha: null, treeSha, parents: [parent], author, committer, message });
      expect(commit.parents).toHaveLength(1);
      expect(commit.parents[0].equals(parent)).toBe(true);
      expect(commit.isRoot()).toBe(false);
      expect(commit.isMerge()).toBe(false);
    });

    it('throws if treeSha is not a GitSha instance', () => {
      expect(() => new GitCommit({ sha: null, treeSha: 'invalid', parents: [], author, committer, message })).toThrow(ValidationError);
    });
  });

  describe('static fromData', () => {
    it('creates a commit from raw data', () => {
      const data = {
        sha: null,
        treeSha: treeSha.toString(),
        parents: [],
        author: { name: 'A', email: 'a@example.com', timestamp: 1 },
        committer: { name: 'C', email: 'c@example.com', timestamp: 2 },
        message: 'msg'
      };
      const commit = GitCommit.fromData(data);
      expect(commit.message).toBe('msg');
      expect(commit.author).toBeInstanceOf(GitSignature);
    });
  });

  describe('type', () => {
    it('returns commit type', () => {
      const commit = new GitCommit({ sha: null, treeSha, parents: [], author, committer, message });
      expect(commit.type().isCommit()).toBe(true);
    });
  });
});