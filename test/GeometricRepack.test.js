import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GitPlumbing from '../index.js';

const LOOSE_OBJECT_DIRECTORY = /^[0-9a-f]{2}$/;
const PACK_SUFFIX = '.pack';

function listLooseObjects(objectsPath) {
  return fs.readdirSync(objectsPath)
    .filter((name) => LOOSE_OBJECT_DIRECTORY.test(name))
    .flatMap((prefix) => fs.readdirSync(path.join(objectsPath, prefix))
      .map((suffix) => `${prefix}${suffix}`))
    .sort();
}

function listPacks(objectsPath) {
  return fs.readdirSync(path.join(objectsPath, 'pack'))
    .filter((name) => name.endsWith(PACK_SUFFIX));
}

describe('geometric repack', () => {
  let git;
  let repoPath;
  let objectsPath;

  beforeEach(async () => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-repack-'));
    objectsPath = path.join(repoPath, '.git', 'objects');
    git = await GitPlumbing.createDefault({ cwd: repoPath });
    await git.execute({ args: ['init'] });
  });

  afterEach(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  it('rolls loose objects into one pack through the sanitized execute path', async () => {
    const oids = [
      await git.execute({ args: ['hash-object', '-w', '--stdin'], input: 'first object' }),
      await git.execute({ args: ['hash-object', '-w', '--stdin'], input: 'second object' }),
      await git.execute({ args: ['hash-object', '-w', '--stdin'], input: 'third object' })
    ].sort();
    expect(listLooseObjects(objectsPath)).toEqual(oids);
    expect(listPacks(objectsPath)).toEqual([]);

    await git.execute({ args: ['repack', '--geometric=2', '-d'] });

    // Oracle: git-repack(1) rolls loose objects into the geometric pack, and
    // -d runs git prune-packed, which removes the now-packed loose copies.
    expect(listPacks(objectsPath)).toHaveLength(1);
    expect(listLooseObjects(objectsPath)).toEqual([]);
    const batchCheck = await git.execute({
      args: ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
      input: `${oids.join('\n')}\n`
    });
    expect(batchCheck.split('\n').sort()).toEqual(oids.map((oid) => `${oid} blob`));
  });
});
