
import GitObjectType from '../../../src/domain/value-objects/GitObjectType.js';
import InvalidGitObjectTypeError from '../../../src/domain/errors/InvalidGitObjectTypeError.js';

describe('GitObjectType', () => {
  describe('constructor', () => {
    it('creates a valid GitObjectType from a valid number', () => {
      const type = new GitObjectType(GitObjectType.BLOB_INT);
      expect(type.toNumber()).toBe(GitObjectType.BLOB_INT);
      expect(type.toString()).toBe(GitObjectType.BLOB);
    });

    it('throws InvalidGitObjectTypeError for invalid number', () => {
      expect(() => new GitObjectType(99)).toThrow(InvalidGitObjectTypeError);
    });
  });

  describe('static fromString', () => {
    it('creates a valid GitObjectType from a valid string', () => {
      const type = GitObjectType.fromString(GitObjectType.TREE);
      expect(type.toNumber()).toBe(GitObjectType.TREE_INT);
      expect(type.toString()).toBe(GitObjectType.TREE);
    });

    it('throws InvalidGitObjectTypeError for invalid string', () => {
      expect(() => GitObjectType.fromString('invalid')).toThrow(InvalidGitObjectTypeError);
    });
  });

  describe('equals', () => {
    it('returns true for equal types', () => {
      const type1 = GitObjectType.blob();
      const type2 = GitObjectType.fromString('blob');
      expect(type1.equals(type2)).toBe(true);
    });

    it('returns false for different types', () => {
      const type1 = GitObjectType.blob();
      const type2 = GitObjectType.tree();
      expect(type1.equals(type2)).toBe(false);
    });
  });

  describe('is methods', () => {
    it('correctly identifies blob', () => {
      expect(GitObjectType.blob().isBlob()).toBe(true);
      expect(GitObjectType.blob().isTree()).toBe(false);
    });

    it('correctly identifies tree', () => {
      expect(GitObjectType.tree().isTree()).toBe(true);
      expect(GitObjectType.tree().isCommit()).toBe(false);
    });

    it('correctly identifies commit', () => {
      expect(GitObjectType.commit().isCommit()).toBe(true);
      expect(GitObjectType.commit().isTag()).toBe(false);
    });

    it('correctly identifies tag', () => {
      expect(GitObjectType.tag().isTag()).toBe(true);
      expect(GitObjectType.tag().isBlob()).toBe(false);
    });
  });
});
