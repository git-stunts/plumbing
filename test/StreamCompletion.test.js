import { describe, it, expect } from 'vitest';
import GitPlumbing from '../index.js';
import ShellRunner from '../ShellRunner.js';

describe('Stream Completion', () => {
  const git = new GitPlumbing({
    runner: ShellRunner.run,
    cwd: process.cwd()
  });

  it('provides a finished promise that resolves on success', async () => {
    const stream = await git.executeStream({ args: ['--version'] });
    
    // Consume stream
    const reader = stream.getReader();
    while (!(await reader.read()).done) { /* noop */ }

    const result = await stream.finished;
    expect(result.code).toBe(0);
  });

  it('provides a finished promise that captures errors', async () => {
    const stream = await git.executeStream({ 
      args: ['hash-object', '--non-existent-flag'] 
    });
    
    const reader = stream.getReader();
    while (!(await reader.read()).done) { /* noop */ }

    const result = await stream.finished;
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('unknown option');
  });
});
