
import GitTreeEntry from '../../../src/domain/entities/GitTreeEntry.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitFileMode from '../../../src/domain/value-objects/GitFileMode.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';

describe('GitTreeEntry', () => {
  const sha = GitSha.EMPTY_TREE;
  const regularMode = new GitFileMode(GitFileMode.REGULAR);
  const treeMode = new GitFileMode(GitFileMode.TREE);
  
  it('creates a valid entry', () => {
    const entry = new GitTreeEntry(regularMode, sha, 'file.txt');
    expect(entry.mode).toBe(regularMode);
    expect(entry.type().isBlob()).toBe(true);
    expect(entry.sha).toBe(sha);
    expect(entry.path).toBe('file.txt');
  });

  it('throws for invalid SHA', () => {
    expect(() => new GitTreeEntry(regularMode, 'not-a-sha', 'file.txt')).toThrow(ValidationError);
  });

  it('identifies tree correctly', () => {
    const entry = new GitTreeEntry(treeMode, sha, 'dir');
    expect(entry.isTree()).toBe(true);
    expect(entry.isBlob()).toBe(false);
  });
});