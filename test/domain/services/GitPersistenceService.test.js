import GitPersistenceService from '../../../src/domain/services/GitPersistenceService.js';
import GitPlumbing from '../../../index.js';
import GitBlob from '../../../src/domain/entities/GitBlob.js';
import GitTree from '../../../src/domain/entities/GitTree.js';
import GitTreeEntry from '../../../src/domain/entities/GitTreeEntry.js';
import GitCommit from '../../../src/domain/entities/GitCommit.js';
import GitSha from '../../../src/domain/value-objects/GitSha.js';
import GitSignature from '../../../src/domain/value-objects/GitSignature.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('GitPersistenceService', () => {
  let git;
  let persistence;
  let repoPath;

  beforeAll(async () => {
    repoPath = path.join(os.tmpdir(), `git-persistence-test-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(repoPath, { recursive: true });
    
    git = GitPlumbing.createDefault({ cwd: repoPath });
    persistence = new GitPersistenceService({ plumbing: git });
    
    await git.execute({ args: ['init'] });
  });

  afterAll(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  it('writes a blob', async () => {
    const blob = GitBlob.fromContent('Persistence test');
    const sha = await persistence.writeBlob(blob);
    
    expect(sha).toBeInstanceOf(GitSha);
    const content = await git.execute({ args: ['cat-file', '-p', sha.toString()] });
    expect(content).toBe('Persistence test');
  });

  it('writes a tree', async () => {
    const blobSha = await persistence.writeBlob(GitBlob.fromContent('file content'));
    const entry = new GitTreeEntry({ path: 'test.txt', sha: blobSha, mode: '100644' });
    const tree = new GitTree(null, [entry]);
    
    const treeSha = await persistence.writeTree(tree);
    expect(treeSha).toBeInstanceOf(GitSha);
    
    const lsTree = await git.execute({ args: ['ls-tree', treeSha.toString()] });
    expect(lsTree).toContain('test.txt');
  });

  it('writes a commit', async () => {
    const blobSha = await persistence.writeBlob(GitBlob.fromContent('file content'));
    const entry = new GitTreeEntry({ path: 'test.txt', sha: blobSha, mode: '100644' });
    const treeSha = await persistence.writeTree(new GitTree(null, [entry]));
    
    const signature = new GitSignature({
      name: 'James',
      email: 'james@test.com',
      timestamp: 1234567890
    });

    const commit = new GitCommit({
      sha: null,
      treeSha,
      parents: [],
      author: signature,
      committer: signature,
      message: 'Persistence commit'
    });

    const commitSha = await persistence.writeCommit(commit);
    expect(commitSha).toBeInstanceOf(GitSha);
    
    const cat = await git.execute({ args: ['cat-file', '-p', commitSha.toString()] });
    expect(cat).toContain('Persistence commit');
    expect(cat).toContain('author James <james@test.com> 1234567890');
  });
});
