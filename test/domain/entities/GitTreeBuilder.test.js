import GitTreeBuilder from '../../../src/domain/entities/GitTreeBuilder.js';
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitFileMode from '../../../src/domain/value-objects/GitFileMode.js';

describe('GitTreeBuilder', () => {
  const sha = GitSha.EMPTY_TREE;

  it('builds a tree with multiple entries', () => {
    const builder = new GitTreeBuilder();
    builder.add({ path: 'file1.txt', sha, mode: GitFileMode.REGULAR });
    builder.add({ path: 'file2.txt', sha, mode: GitFileMode.EXECUTABLE });
    
    const tree = builder.build();
    expect(tree).toBeInstanceOf(GitTree);
    expect(tree.entries).toHaveLength(2);
    expect(tree.entries[0].path).toBe('file1.txt');
    expect(tree.entries[1].mode.isExecutable()).toBe(true);
  });

  it('is fluent', () => {
    const tree = new GitTreeBuilder()
      .add({ path: 'a', sha, mode: GitFileMode.REGULAR })
      .add({ path: 'b', sha, mode: GitFileMode.REGULAR })
      .build();
    
    expect(tree.entries).toHaveLength(2);
  });
});
