import GitTreeEntry from '../../../src/domain/entities/GitTreeEntry.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitFileMode from '../../../src/domain/value-objects/GitFileMode.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';

describe('GitTreeEntry', () => {
  const sha = GitSha.EMPTY_TREE;
  const regularMode = new GitFileMode(GitFileMode.REGULAR);
  const treeMode = new GitFileMode(GitFileMode.TREE);

  it('creates a valid entry', () => {
    const entry = new GitTreeEntry({ mode: regularMode, sha, path: 'file.txt' });
    expect(entry.mode).toBe(regularMode);
    expect(entry.sha).toBe(sha);
    expect(entry.path).toBe('file.txt');
  });

  it('throws for invalid SHA', () => {
    expect(() => new GitTreeEntry({ mode: regularMode, sha: 'not-a-sha', path: 'file.txt' })).toThrow(ValidationError);
  });

  it('identifies tree correctly', () => {
    const entry = new GitTreeEntry({ mode: treeMode, sha, path: 'dir' });
    expect(entry.isTree()).toBe(true);
    expect(entry.isBlob()).toBe(false);
  });
});