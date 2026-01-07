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
    // hash-object with an invalid flag produces stderr and exit code 129
    const result = await ShellRunner.run({
      command: 'git',
      args: ['hash-object', '--invalid-flag']
    });

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('unknown option');
  });

  it('handles stdin', async () => {
    const result = await ShellRunner.run({
      command: 'git',
      args: ['hash-object', '--stdin'],
      input: 'hello world'
    });

    expect(result.code).toBe(0);
    // SHA1 for "hello world" is 95d09f2b10159347eece71399a7e2e907ea3df4f
    expect(result.stdout.trim()).toBe('95d09f2b10159347eece71399a7e2e907ea3df4f');
  });
});
