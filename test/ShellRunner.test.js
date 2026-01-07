
import ShellRunner from '../ShellRunner.js';

describe('ShellRunner', () => {
  it('executes a simple command (git --version)', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['--version']
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('git version');
  });

  it('captures stderr', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['invalid-command']
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('not a git command');
  });

  it('handles stdin', async () => {
    // Using cat to test stdin
    const result = await ShellRunner.run({
      command: 'cat',
      args: [],
      input: 'hello world'
    });

    expect(result.stdout).toBe('hello world');
  });
});
