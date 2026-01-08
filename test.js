/**
 * @fileoverview Integration tests for GitPlumbing
 */

import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import GitPlumbing from './index.js';
import GitRepositoryService from './src/domain/services/GitRepositoryService.js';

describe('GitPlumbing', () => {
  let tempDir;
  let plumbing;
  let repo;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-test-'));
    plumbing = new GitPlumbing({ cwd: tempDir });
    repo = new GitRepositoryService({ plumbing });
    // Initialize a repo for testing
    await plumbing.execute({ args: ['init'] });
    await plumbing.verifyInstallation();
    await plumbing.execute({ args: ['config', 'user.name', 'Tester'] });
    await plumbing.execute({ args: ['config', 'user.email', 'test@example.com'] });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('executes basic git commands', async () => {
    const out = await plumbing.execute({ args: ['rev-parse', '--is-inside-work-tree'] });
    expect(out).toBe('true');
  });

  it('resolves the empty tree constant', () => {
    expect(plumbing.emptyTree).toBe('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
  });

  it('updates and parses refs', async () => {
    const commitSha = await plumbing.execute({ 
      args: ['commit-tree', plumbing.emptyTree, '-m', 'test'] 
    });
    
    await repo.updateRef({ ref: 'refs/heads/test', newSha: commitSha });
    const resolved = await repo.revParse({ revision: 'refs/heads/test' });
    
    expect(resolved).toBe(commitSha);
  });

  it('handles errors with telemetry', async () => {
    await expect(
      plumbing.execute({ args: ['rev-parse', '--non-existent-flag'] })
    ).rejects.toThrow('Git command failed');
  });

  it('executes with status for non-zero exit codes', async () => {
    const result = await plumbing.executeWithStatus({ args: ['rev-parse', '--non-existent-flag'] });
    expect(result.status).not.toBe(0);
  });
});
