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
  describe('static from', () => {
    it('creates a valid GitSha from a valid SHA string', () => {
      const sha = GitSha.from(EMPTY_TREE_SHA);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });

    it('throws ValidationError for invalid SHA string', () => {
      let error;
      try {
        GitSha.from(INVALID_SHA_ALPHABETIC);
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('Invalid SHA-1 hash');
      expect(error.details.helpUrl).toBe('https://git-scm.com/book/en/v2/Git-Internals-Git-Objects');
    });

    it('throws error for SHA with wrong length', () => {
      expect(() => GitSha.from(INVALID_SHA_TOO_SHORT)).toThrow(ValidationError);
      expect(() => GitSha.from(INVALID_SHA_TOO_LONG)).toThrow(ValidationError);
    });

    it('throws error for SHA with invalid characters', () => {
      expect(() => GitSha.from(INVALID_SHA_ALPHABETIC)).toThrow(ValidationError);
    });

    it('converts SHA to lowercase', () => {
      const sha = GitSha.from(INVALID_SHA_MIXED_CASE);
      expect(sha.toString()).toBe(EMPTY_TREE_SHA);
    });
  });

  describe('equals', () => {
    it('returns true for equal SHAs', () => {
      const sha1 = GitSha.from(EMPTY_TREE_SHA);
      const sha2 = GitSha.from(EMPTY_TREE_SHA);
      expect(sha1.equals(sha2)).toBe(true);
    });

    it('returns false for different SHAs', () => {
      const sha1 = GitSha.from(EMPTY_TREE_SHA);
      const sha2 = GitSha.from(VALID_SHA_1);
      expect(sha1.equals(sha2)).toBe(false);
    });

    it('returns false when comparing with non-GitSha', () => {
      const sha = GitSha.from(EMPTY_TREE_SHA);
      expect(sha.equals(EMPTY_TREE_SHA)).toBe(false);
      expect(sha.equals(null)).toBe(false);
      expect(sha.equals({})).toBe(false);
    });
  });

  describe('toShort', () => {
    it('returns first 7 characters of SHA', () => {
      const sha = GitSha.from(VALID_SHA_1);
      expect(sha.toShort()).toBe('a1b2c3d');
    });
  });

  describe('isEmptyTree', () => {
    it('returns true for empty tree SHA', () => {
      const sha = GitSha.EMPTY_TREE;
      expect(sha.isEmptyTree()).toBe(true);
    });

    it('returns false for non-empty tree SHA', () => {
      const sha = GitSha.from(VALID_SHA_1);
      expect(sha.isEmptyTree()).toBe(false);
    });
  });

  describe('JSON serialization', () => {
    it('serializes to string representation', () => {
      const sha = GitSha.from(VALID_SHA_2);
      expect(JSON.stringify(sha)).toBe(`"${VALID_SHA_2}"`);
    });
  });
});