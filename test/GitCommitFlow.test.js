import GitPlumbing from '../index.js';
import GitSignature from '../src/domain/value-objects/GitSignature.js';
import GitSha from '../src/domain/value-objects/GitSha.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

describe('Git Commit Flow', () => {
  let git;
  let repoPath;

  beforeAll(async () => {
    repoPath = path.join(os.tmpdir(), `git-plumbing-test-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(repoPath, { recursive: true });
    
    git = GitPlumbing.createDefault({ cwd: repoPath });
    
    // Initialize repository
    await git.execute({ args: ['init'] });
  });

  afterAll(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  it('orchestrates a full commit sequence', async () => {
    const signature = new GitSignature({
      name: 'James Ross',
      email: 'james@flyingrobots.dev',
      timestamp: Math.floor(Date.now() / 1000)
    });

    const commitSha = await git.commit({
      branch: 'refs/heads/main',
      message: 'Orchestrated commit',
      author: signature,
      committer: signature,
      parents: [],
      files: [
        { path: 'hello.txt', content: 'Hello from flow!' },
        { path: 'test.bin', content: new Uint8Array([1, 2, 3, 4, 5]) }
      ]
    });

    expect(commitSha).toBeInstanceOf(GitSha);
    
    // Verify the commit exists
    const verifiedMessage = await git.execute({
      args: ['cat-file', '-p', commitSha.toString()]
    });
    expect(verifiedMessage).toContain('Orchestrated commit');
    
    // Verify reference was updated
    const headSha = await git.execute({
      args: ['rev-parse', 'refs/heads/main']
    });
    expect(headSha.trim()).toBe(commitSha.toString());
  });
});
