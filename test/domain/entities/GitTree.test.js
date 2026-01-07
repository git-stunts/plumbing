
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitTreeEntry from '../../../src/domain/entities/GitTreeEntry.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitFileMode from '../../../src/domain/value-objects/GitFileMode.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';

describe('GitTree', () => {
  const sha = GitSha.EMPTY_TREE;
  const regularMode = new GitFileMode(GitFileMode.REGULAR);

  describe('constructor', () => {
    it('creates a tree with entries', () => {
      const entry = new GitTreeEntry(regularMode, sha, 'file.txt');
      const tree = new GitTree(null, [entry]);
      expect(tree.entries).toHaveLength(1);
      expect(tree.entries[0]).toBe(entry);
    });

    it('throws for invalid SHA', () => {
      expect(() => new GitTree(123, [])).toThrow(ValidationError);
    });
  });

  describe('static empty', () => {
    it('creates an empty tree with empty tree SHA', () => {
      const tree = GitTree.empty();
      expect(tree.sha.isEmptyTree()).toBe(true);
      expect(tree.entries).toHaveLength(0);
    });
  });

  describe('addEntry', () => {
    it('adds an entry and returns new tree (deprecated path, now O(N))', () => {
      const tree = new GitTree(null, []);
      const entry = new GitTreeEntry(regularMode, sha, 'file.txt');
      const newTree = tree.addEntry(entry);
      expect(newTree.entries).toHaveLength(1);
      expect(newTree.entries[0]).toBe(entry);
      expect(tree.entries).toHaveLength(0); // Immutable
    });

    it('throws when adding non-entry', () => {
      const tree = new GitTree(null, []);
      expect(() => tree.addEntry({})).toThrow(ValidationError);
    });
  });

  describe('type', () => {
    it('returns tree type', () => {
      const tree = new GitTree(null, []);
      expect(tree.type().isTree()).toBe(true);
    });
  });
});