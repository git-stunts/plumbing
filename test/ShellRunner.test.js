import ShellRunner from '../ShellRunner.js';

describe('ShellRunner', () => {
  it('executes a simple command (git help)', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['help']
    });

    expect(result.stdoutStream).toBeDefined();
    
    // Consume stream to avoid hanging
    const reader = result.stdoutStream.getReader ? result.stdoutStream.getReader() : null;
    if (reader) {
      while (!(await reader.read()).done) {}
    } else {
      for await (const _ of result.stdoutStream) {}
    }

    const { code } = await result.exitPromise;
    expect(code).toBe(0);
  });

  it('captures stderr', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['hash-object', '--invalid-flag']
    });

    const { code, stderr } = await result.exitPromise;
    expect(code).not.toBe(0);
    expect(stderr).toContain('unknown option');
  });

  it('handles stdin', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['hash-object', '--stdin'],
      input: 'hello world'
    });

    let stdout = '';
    const decoder = new TextDecoder();
    for await (const chunk of result.stdoutStream) {
      stdout += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
    }

    const { code } = await result.exitPromise;
    expect(code).toBe(0);
    expect(stdout.trim()).toBe('95d09f2b10159347eece71399a7e2e907ea3df4f');
  });
});
