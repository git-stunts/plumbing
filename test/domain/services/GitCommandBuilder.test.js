import GitCommandBuilder from '../../../src/domain/services/GitCommandBuilder.js';

describe('GitCommandBuilder', () => {
  it('builds a hash-object command with flags', () => {
    const args = GitCommandBuilder.hashObject()
      .write()
      .stdin()
      .build();
    
    expect(args).toEqual(['hash-object', '-w', '--stdin']);
  });

  it('builds a cat-file command with pretty-print', () => {
    const args = GitCommandBuilder.catFile()
      .pretty()
      .arg('HEAD')
      .build();
    
    expect(args).toEqual(['cat-file', '-p', 'HEAD']);
  });

  it('builds a commit-tree command with tree SHA and parents', () => {
    const treeSha = 'a'.repeat(40);
    const parent1 = 'b'.repeat(40);
    const parent2 = 'c'.repeat(40);
    
    const args = GitCommandBuilder.commitTree()
      .arg(treeSha)
      .parent(parent1)
      .parent(parent2)
      .build();
    
    expect(args).toEqual([
      'commit-tree', 
      treeSha, 
      '-p', parent1, 
      '-p', parent2
    ]);
  });

  it('builds an update-ref command with delete', () => {
    const args = GitCommandBuilder.updateRef()
      .delete()
      .arg('refs/heads/main')
      .build();
    
    expect(args).toEqual(['update-ref', '-d', 'refs/heads/main']);
  });

  it('handles all static factory methods', () => {
    // Spot check a few more
    expect(GitCommandBuilder.lsTree().build()).toEqual(['ls-tree']);
    expect(GitCommandBuilder.revList().build()).toEqual(['rev-list']);
    expect(GitCommandBuilder.init().build()).toEqual(['init']);
    expect(GitCommandBuilder.version().build()).toEqual(['--version']);
  });
});
