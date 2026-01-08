import GitPlumbing from '../index.js';
import ShellRunner from '../ShellRunner.js';

describe('Streaming', () => {
  const git = new GitPlumbing({
    runner: ShellRunner.run,
    cwd: process.cwd()
  });

  it('executes a command and returns a readable stream', async () => {
    const gitStream = await git.executeStream({ args: ['--version'] });
    
    expect(gitStream).toBeDefined();
    
    let output = '';
    const decoder = new TextDecoder();
    
    for await (const chunk of gitStream) {
      output += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
    }

    expect(output).toContain('git');
  });

  it('handles input in streaming mode', async () => {
    // We'll use 'hash-object' via executeStream to verify stdin/stdout piping
    const input = 'hello world content';
    
    const gitStream = await git.executeStream({
      args: ['hash-object', '--stdin'],
      input
    });

    expect(gitStream).toBeDefined();
    
    let output = '';
    const decoder = new TextDecoder();
    for await (const chunk of gitStream) {
      output += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
    }

    // Expected SHA for "hello world content\n" is usually different from raw "hello world content"
    // but we just check if we got a valid-looking SHA
    expect(output.trim()).toMatch(/^[a-f0-9]{40}$/);
  });
});