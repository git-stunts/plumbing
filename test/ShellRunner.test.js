import ShellRunner from '../ShellRunner.js';

describe('ShellRunner', () => {
  it('executes a simple command (git help)', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['help']
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('git');
  });

  it('captures stderr', async () => {
    const result = await ShellRunner.run({
      command: 'sh',
      args: ['-c', 'echo "test error message" >&2 && exit 1']
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('test error message');
  });

  it('handles stdin', async () => {
    const result = await ShellRunner.run({
      command: 'cat',
      args: [],
      input: 'hello world'
    });

    expect(result.stdout).toBe('hello world');
  });
});
