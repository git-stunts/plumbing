
import GitSha from '../src/domain/value-objects/GitSha.js';
import ValidationError from '../src/domain/errors/ValidationError.js';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const VALID_SHA_1 = 'a1b2c3d4e5f67890123456789012345678901234';
const VALID_SHA_2 = 'f1e2d3c4b5a697887766554433221100ffeeddcc';
const INVALID_SHA_ALPHABETIC = 'gggggggggggggggggggggggggggggggggggggggg';
const INVALID_SHA_TOO_SHORT = '4b825dc642cb6eb9a060e54bf8d69288fbee490';
const INVALID_SHA_TOO_LONG = '4b825dc642cb6eb9a060e54bf8d69288fbee49044';
const INVALID_SHA_MIXED_CASE = '4B825DC642CB6EB9A060E54BF8D69288FBEE4904';

describe('GitSha', () => {
  describe('constructor', () => {
    it('creates a valid GitSha from a valid SHA string', () => {
      const sha = new GitSha(EMPTY_TREE_SHA);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });

    it('throws error for invalid SHA string', () => {
      expect(() => new GitSha(INVALID_SHA_ALPHABETIC)).toThrow(ValidationError);
      expect(() => new GitSha(INVALID_SHA_ALPHABETIC)).toThrow('Invalid SHA-1 hash: gggggggggggggggggggggggggggggggggggggggg');
    });

    it('throws error for SHA with wrong length', () => {
      expect(() => new GitSha(INVALID_SHA_TOO_SHORT)).toThrow();
      expect(() => new GitSha(INVALID_SHA_TOO_LONG)).toThrow();
    });

    it('throws error for SHA with invalid characters', () => {
      expect(() => new GitSha(INVALID_SHA_ALPHABETIC)).toThrow();
    });

    it('converts SHA to lowercase', () => {
      const sha = new GitSha(INVALID_SHA_MIXED_CASE);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });
  });

  describe('static isValid', () => {
    it('returns true for valid SHA', () => {
      expect(GitSha.isValid(EMPTY_TREE_SHA)).toBe(true);
    });

    it('returns false for invalid SHA', () => {
      expect(GitSha.isValid(INVALID_SHA_ALPHABETIC)).toBe(false);
    });

    it('returns false for SHA with wrong length', () => {
      expect(GitSha.isValid(INVALID_SHA_TOO_SHORT)).toBe(false);
      expect(GitSha.isValid(INVALID_SHA_TOO_LONG)).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(GitSha.isValid(123)).toBe(false);
      expect(GitSha.isValid(null)).toBe(false);
      expect(GitSha.isValid(undefined)).toBe(false);
    });
  });

  describe('static fromString', () => {
    it('creates GitSha from valid string', () => {
      const sha = GitSha.fromString(EMPTY_TREE_SHA);
      expect(sha).toBeInstanceOf(GitSha);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });

    it('throws error for invalid string', () => {
      expect(() => GitSha.fromString(INVALID_SHA_ALPHABETIC)).toThrow('Invalid SHA-1 hash: gggggggggggggggggggggggggggggggggggggggg');
    });
  });

  describe('static fromStringOrNull', () => {
    it('creates GitSha from valid string', () => {
      const sha = GitSha.fromStringOrNull(EMPTY_TREE_SHA);
      expect(sha).toBeInstanceOf(GitSha);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });

    it('returns null for invalid string', () => {
      const sha = GitSha.fromStringOrNull(INVALID_SHA_ALPHABETIC);
      expect(sha).toBeNull();
    });
  });

  describe('equals', () => {
    it('returns true for equal SHAs', () => {
      const sha1 = new GitSha(EMPTY_TREE_SHA);
      const sha2 = new GitSha(EMPTY_TREE_SHA);
      expect(sha1.equals(sha2)).toBe(true);
    });

    it('returns false for different SHAs', () => {
      const sha1 = new GitSha(EMPTY_TREE_SHA);
      const sha2 = new GitSha(VALID_SHA_1);
      expect(sha1.equals(sha2)).toBe(false);
    });

    it('returns false when comparing with non-GitSha', () => {
      const sha = new GitSha(EMPTY_TREE_SHA);
      expect(sha.equals(EMPTY_TREE_SHA)).toBe(false);
      expect(sha.equals(null)).toBe(false);
      expect(sha.equals({})).toBe(false);
    });
  });

  describe('toShort', () => {
    it('returns first 7 characters of SHA', () => {
      const sha = new GitSha(VALID_SHA_1);
      expect(sha.toShort()).toBe('a1b2c3d');
    });
  });

  describe('isEmptyTree', () => {
    it('returns true for empty tree SHA', () => {
      const sha = GitSha.EMPTY_TREE;
      expect(sha.isEmptyTree()).toBe(true);
    });

    it('returns false for non-empty tree SHA', () => {
      const sha = new GitSha(VALID_SHA_1);
      expect(sha.isEmptyTree()).toBe(false);
    });
  });

  describe('JSON serialization', () => {
    it('serializes to string representation', () => {
      const sha = new GitSha(VALID_SHA_2);
      expect(JSON.stringify(sha)).toBe(`"${VALID_SHA_2}"`);
    });
  });
});