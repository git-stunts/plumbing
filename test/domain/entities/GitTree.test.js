import GitTree from '../../../src/domain/entities/GitTree.js';
import GitTreeEntry from '../../../src/domain/entities/GitTreeEntry.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';

describe('GitTree', () => {
  const VALID_SHA = 'a1b2c3d4e5f67890123456789012345678901234';
  const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

  it('serializes to mktree format', () => {
    const entry1 = new GitTreeEntry({
      path: 'file.txt',
      sha: GitSha.from(VALID_SHA),
      mode: '100644'
    });
    const entry2 = new GitTreeEntry({
      path: 'subdir',
      sha: GitSha.from(EMPTY_TREE_SHA),
      mode: '040000'
    });
    const tree = new GitTree(null, [entry1, entry2]);

    const format = tree.toMktreeFormat();
    expect(format).toBe(`100644 blob ${VALID_SHA}\tfile.txt\n040000 tree ${EMPTY_TREE_SHA}\tsubdir\n`);
  });

  it('returns empty string for empty tree mktree format', () => {
    const tree = new GitTree(null, []);
    expect(tree.toMktreeFormat()).toBe('\n');
  });

  it('can be created from data', () => {
    const data = {
      sha: VALID_SHA,
      entries: [
        { path: 'f.txt', sha: VALID_SHA, mode: '100644' }
      ]
    };
    const tree = GitTree.fromData(data);
    expect(tree.sha.toString()).toBe(VALID_SHA);
    expect(tree.entries[0].path).toBe('f.txt');
  });
});
