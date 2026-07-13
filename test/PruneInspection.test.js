import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GitPlumbing from '../index.js';
import InvalidArgumentError from '../src/domain/errors/InvalidArgumentError.js';

describe('prunable-object inspection', () => {
  let git;
  let repoPath;

  beforeEach(async () => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-prune-'));
    git = await GitPlumbing.createDefault({ cwd: repoPath });
    await git.execute({ args: ['init'] });
  });

  afterEach(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  it('streams dry-run candidates without deleting them', async () => {
    const oid = await git.execute({
      args: ['hash-object', '-w', '--stdin'],
      input: 'unreachable test object'
    });
    const expiresBefore = new Date(Date.now() + 60_000).toISOString();
    const stream = await git.inspectPrunableObjects({ expiresBefore });
    const output = await stream.collect({ asString: true });
    const result = await stream.finished;

    expect(result.code).toBe(0);
    expect(output).toContain(`${oid} blob`);
    await expect(git.execute({ args: ['cat-file', '-t', oid] })).resolves.toBe('blob');
  });

  for (const expiresBefore of [
    undefined,
    'now',
    '2026-07-01',
    '2026-13-01T00:00:00.000Z',
    '2026-07-01T00:00:00Z'
  ]) {
    it(`rejects a non-canonical cutoff before execution: ${String(expiresBefore)}`, async () => {
      await expect(git.inspectPrunableObjects({ expiresBefore }))
        .rejects.toBeInstanceOf(InvalidArgumentError);
    });
  }

  it('rejects omitted options with the public validation error', async () => {
    await expect(git.inspectPrunableObjects()).rejects.toBeInstanceOf(InvalidArgumentError);
  });
});
