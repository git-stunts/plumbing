import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('protocol benchmark CLI', () => {
  it('preserves equals signs in option values', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plumbing-benchmark-cli-'));
    const output = path.join(root, 'report=sha256.json');
    const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

    try {
      const result = spawnSync(
        process.execPath,
        [
          'benchmarks/protocol-sessions.js',
          '--objects=1',
          '--batch-size=1',
          '--blob-bytes=32',
          '--runs=1',
          '--warmups=0',
          `--output=${output}`,
        ],
        { cwd: repository, encoding: 'utf8', env: process.env }
      );

      expect(result.status, result.stderr).toBe(0);
      expect(fs.existsSync(output)).toBe(true);
      expect(JSON.parse(fs.readFileSync(output, 'utf8')).parameters.output).toBe(output);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
