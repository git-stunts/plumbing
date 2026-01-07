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

  it('handles large-ish input in streaming mode', async () => {
    // We'll use 'cat' via executeStream to verify stdin/stdout piping
    const input = 'A'.repeat(1000);
    
    // GitPlumbing.executeStream is hardcoded to 'git', so we test the runner directly
    const result = await ShellRunner.run({
      command: 'cat',
      args: [],
      input,
      stream: true
    });

    expect(result.stdoutStream).toBeDefined();
    
    let output = '';
    const decoder = new TextDecoder();
    for await (const chunk of result.stdoutStream) {
      output += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
    }

    expect(output).toBe(input);
  });
});
