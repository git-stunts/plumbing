
import GitRef from '../src/domain/value-objects/GitRef.js';
import ValidationError from '../src/domain/errors/ValidationError.js';

const VALID_REF_1 = 'refs/heads/main';
const VALID_REF_2 = 'refs/tags/v1.0.0';
const VALID_REF_3 = 'refs/remotes/origin/main';
const INVALID_REF_DOT_START = '.refs/heads/main';
const INVALID_REF_DOUBLE_DOT = 'refs/heads/../main';
const INVALID_REF_DOT_END = 'refs/heads/main.';
const INVALID_REF_SLASH_DOT = 'refs/heads/.main';
const INVALID_REF_AT_SYMBOL = 'refs/heads/@';
const INVALID_REF_BACKSLASH = 'refs/heads\\main';
const INVALID_REF_CONTROL_CHARS = 'refs/heads/main\x00';
const INVALID_REF_SPACE = 'refs/heads/main branch';
const INVALID_REF_CONSECUTIVE_SLASHES = 'refs//heads/main';

describe('GitRef', () => {
  describe('constructor', () => {
    it('creates a valid GitRef from a valid reference string', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.toString()).toBe(VALID_REF_1);
    });

    it('throws error for invalid reference string', () => {
      expect(() => new GitRef(INVALID_REF_DOT_START)).toThrow(ValidationError);
      expect(() => new GitRef(INVALID_REF_DOT_START)).toThrow('Invalid Git reference: .refs/heads/main');
    });

    it('throws error for reference starting with dot', () => {
      expect(() => new GitRef(INVALID_REF_DOT_START)).toThrow();
    });

    it('throws error for reference containing double dots', () => {
      expect(() => new GitRef(INVALID_REF_DOUBLE_DOT)).toThrow();
    });

    it('throws error for reference ending with dot', () => {
      expect(() => new GitRef(INVALID_REF_DOT_END)).toThrow();
    });

    it('throws error for reference containing slash-dot', () => {
      expect(() => new GitRef(INVALID_REF_SLASH_DOT)).toThrow();
    });

    it('throws error for reference with @ symbol', () => {
      expect(() => new GitRef(INVALID_REF_AT_SYMBOL)).toThrow();
    });

    it('throws error for reference containing backslash', () => {
      expect(() => new GitRef(INVALID_REF_BACKSLASH)).toThrow();
    });

    it('throws error for reference containing control characters', () => {
      expect(() => new GitRef(INVALID_REF_CONTROL_CHARS)).toThrow();
    });

    it('throws error for reference with space', () => {
      expect(() => new GitRef(INVALID_REF_SPACE)).toThrow();
    });

    it('throws error for reference with consecutive slashes', () => {
      expect(() => new GitRef(INVALID_REF_CONSECUTIVE_SLASHES)).toThrow();
    });
  });

  describe('static isValid', () => {
    it('returns true for valid branch reference', () => {
      expect(GitRef.isValid(VALID_REF_1)).toBe(true);
    });

    it('returns true for valid tag reference', () => {
      expect(GitRef.isValid(VALID_REF_2)).toBe(true);
    });

    it('returns true for valid remote reference', () => {
      expect(GitRef.isValid(VALID_REF_3)).toBe(true);
    });

    it('returns false for invalid reference', () => {
      expect(GitRef.isValid(INVALID_REF_DOT_START)).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(GitRef.isValid(123)).toBe(false);
      expect(GitRef.isValid(null)).toBe(false);
      expect(GitRef.isValid(undefined)).toBe(false);
    });
  });

  describe('static fromString', () => {
    it('creates GitRef from valid string', () => {
      const ref = GitRef.fromString(VALID_REF_1);
      expect(ref).toBeInstanceOf(GitRef);
      expect(ref.toString()).toBe(VALID_REF_1);
    });

    it('throws error for invalid string', () => {
      expect(() => GitRef.fromString(INVALID_REF_DOT_START)).toThrow('Invalid Git reference: .refs/heads/main');
    });
  });

  describe('static fromStringOrNull', () => {
    it('creates GitRef from valid string', () => {
      const ref = GitRef.fromStringOrNull(VALID_REF_1);
      expect(ref).toBeInstanceOf(GitRef);
      expect(ref.toString()).toBe(VALID_REF_1);
    });

    it('returns null for invalid string', () => {
      const ref = GitRef.fromStringOrNull(INVALID_REF_DOT_START);
      expect(ref).toBeNull();
    });
  });

  describe('equals', () => {
    it('returns true for equal refs', () => {
      const ref1 = new GitRef(VALID_REF_1);
      const ref2 = new GitRef(VALID_REF_1);
      expect(ref1.equals(ref2)).toBe(true);
    });

    it('returns false for different refs', () => {
      const ref1 = new GitRef(VALID_REF_1);
      const ref2 = new GitRef(VALID_REF_2);
      expect(ref1.equals(ref2)).toBe(false);
    });

    it('returns false when comparing with non-GitRef', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.equals(VALID_REF_1)).toBe(false);
      expect(ref.equals(null)).toBe(false);
      expect(ref.equals({})).toBe(false);
    });
  });

  describe('isBranch', () => {
    it('returns true for branch reference', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.isBranch()).toBe(true);
    });

    it('returns false for non-branch reference', () => {
      const ref = new GitRef(VALID_REF_2);
      expect(ref.isBranch()).toBe(false);
    });
  });

  describe('isTag', () => {
    it('returns true for tag reference', () => {
      const ref = new GitRef(VALID_REF_2);
      expect(ref.isTag()).toBe(true);
    });

    it('returns false for non-tag reference', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.isTag()).toBe(false);
    });
  });

  describe('isRemote', () => {
    it('returns true for remote reference', () => {
      const ref = new GitRef(VALID_REF_3);
      expect(ref.isRemote()).toBe(true);
    });

    it('returns false for non-remote reference', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.isRemote()).toBe(false);
    });
  });

  describe('shortName', () => {
    it('returns short name for branch reference', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(ref.shortName()).toBe('main');
    });

    it('returns short name for tag reference', () => {
      const ref = new GitRef(VALID_REF_2);
      expect(ref.shortName()).toBe('v1.0.0');
    });

    it('returns short name for remote reference', () => {
      const ref = new GitRef(VALID_REF_3);
      expect(ref.shortName()).toBe('origin/main');
    });

    it('returns full reference for other refs', () => {
      const ref = new GitRef('refs/other/unknown');
      expect(ref.shortName()).toBe('refs/other/unknown');
    });
  });

  describe('static branch', () => {
    it('creates branch reference', () => {
      const ref = GitRef.branch('feature/new');
      expect(ref.toString()).toBe('refs/heads/feature/new');
      expect(ref.isBranch()).toBe(true);
    });
  });

  describe('static tag', () => {
    it('creates tag reference', () => {
      const ref = GitRef.tag('v2.0.0');
      expect(ref.toString()).toBe('refs/tags/v2.0.0');
      expect(ref.isTag()).toBe(true);
    });
  });

  describe('static remote', () => {
    it('creates remote reference', () => {
      const ref = GitRef.remote('origin', 'develop');
      expect(ref.toString()).toBe('refs/remotes/origin/develop');
      expect(ref.isRemote()).toBe(true);
    });
  });

  describe('JSON serialization', () => {
    it('serializes to string representation', () => {
      const ref = new GitRef(VALID_REF_1);
      expect(JSON.stringify(ref)).toBe(`"${VALID_REF_1}"`);
    });
  });
});