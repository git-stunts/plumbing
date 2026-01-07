
import GitBlob from '../src/domain/entities/GitBlob.js';
import GitSha from '../src/domain/value-objects/GitSha.js';
import InvalidArgumentError from '../src/domain/errors/InvalidArgumentError.js';

const BLOB_CONTENT = 'Hello, world!';
const EMPTY_CONTENT = '';
const HELLO_BYTES = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

describe('GitBlob', () => {
  describe('constructor', () => {
    it('creates a GitBlob with null SHA and content', () => {
      const blob = new GitBlob(null, BLOB_CONTENT);
      expect(blob.sha).toBeNull();
      expect(blob.content).toBe(BLOB_CONTENT);
    });

    it('creates a GitBlob with SHA and content', () => {
      const sha = GitSha.EMPTY_TREE;
      const blob = new GitBlob(sha, BLOB_CONTENT);
      expect(blob.sha).toBe(sha);
      expect(blob.content).toBe(BLOB_CONTENT);
    });

    it('throws error when SHA is not a GitSha instance', () => {
      expect(() => new GitBlob('invalid-sha', BLOB_CONTENT)).toThrow(InvalidArgumentError);
      expect(() => new GitBlob('invalid-sha', BLOB_CONTENT)).toThrow('SHA must be a GitSha instance or null');
    });

    it('accepts binary content', () => {
      const blob = new GitBlob(null, HELLO_BYTES);
      expect(blob.content).toBe(HELLO_BYTES);
    });
  });

  describe('static fromContent', () => {
    it('creates GitBlob from string content', () => {
      const blob = GitBlob.fromContent(BLOB_CONTENT);
      expect(blob).toBeInstanceOf(GitBlob);
      expect(blob.sha).toBeNull();
      expect(blob.content).toBe(BLOB_CONTENT);
    });

    it('creates GitBlob from binary content', () => {
      const blob = GitBlob.fromContent(HELLO_BYTES);
      expect(blob).toBeInstanceOf(GitBlob);
      expect(blob.sha).toBeNull();
      expect(blob.content).toBe(HELLO_BYTES);
    });
  });

  describe('isWritten', () => {
    it('returns false for unwritten blob', () => {
      const blob = new GitBlob(null, BLOB_CONTENT);
      expect(blob.isWritten()).toBe(false);
    });

    it('returns true for written blob', () => {
      const sha = GitSha.EMPTY_TREE;
      const blob = new GitBlob(sha, BLOB_CONTENT);
      expect(blob.isWritten()).toBe(true);
    });
  });

  describe('size', () => {
    it('returns string content size in bytes', () => {
      const blob = new GitBlob(null, BLOB_CONTENT);
      expect(blob.size()).toBe(BLOB_CONTENT.length);
    });

    it('returns binary content size', () => {
      const blob = new GitBlob(null, HELLO_BYTES);
      expect(blob.size()).toBe(HELLO_BYTES.length);
    });

    it('returns 0 for empty content', () => {
      const blob = new GitBlob(null, EMPTY_CONTENT);
      expect(blob.size()).toBe(0);
    });
  });

  describe('type', () => {
    it('returns blob type', () => {
      const blob = new GitBlob(null, BLOB_CONTENT);
      expect(blob.type().isBlob()).toBe(true);
    });
  });
});