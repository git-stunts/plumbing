import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GitPlumbing from '../index.js';

describe('caller environment overrides', () => {
  it('cannot replace the Git executable through PATH', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plumbing-env-security-'));
    const callerBin = path.join(root, 'caller-bin');
    const callerGit = path.join(callerBin, 'git');

    try {
      fs.mkdirSync(callerBin);
      fs.writeFileSync(callerGit, '#!/bin/sh\nprintf "caller-controlled git\\n"\n');
      fs.chmodSync(callerGit, 0o755);

      const git = await GitPlumbing.createDefault({ cwd: root });
      const version = await git.execute({
        args: ['--version'],
        env: { PATH: callerBin },
      });

      expect(version).toMatch(/^git version /);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
