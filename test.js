/**
 * @fileoverview Integration tests for GitPlumbing
 */

/* global beforeEach, afterEach */

import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import GitPlumbing from './index.js';

describe('GitPlumbing', () => {
  let tempDir;
  let plumbing;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-test-'));
    plumbing = new GitPlumbing({ cwd: tempDir });
    // Initialize a repo for testing
    plumbing.execute({ args: ['init'] });
    plumbing.execute({ args: ['config', 'user.name', 'Tester'] });
    plumbing.execute({ args: ['config', 'user.email', 'test@example.com'] });
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
    
    await plumbing.updateRef({ ref: 'refs/heads/test', newSha: commitSha });
    const resolved = await plumbing.revParse({ revision: 'refs/heads/test' });
    
    expect(resolved).toBe(commitSha);
  });

  it('handles errors with telemetry', async () => {
    try {
      await plumbing.execute({ args: ['rev-parse', '--non-existent-flag'] });
    } catch (err) {
      expect(err.message).toContain('Git command failed');
    }
  });

  it('executes with status for non-zero exit codes', async () => {
    const result = await plumbing.executeWithStatus({ args: ['rev-parse', '--non-existent-flag'] });
    expect(result.status).not.toBe(0);
  });
});
