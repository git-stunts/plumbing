import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GitPlumbing, {
  CommandSession,
  GitCatFileSession,
  GitFastImportSession,
  GitMktreeSession,
  GitUpdateRefSession,
} from '../index.js';
import GitPlumbingError from '../src/domain/errors/GitPlumbingError.js';
import GitObjectMissingError from '../src/domain/errors/GitObjectMissingError.js';
import GitProtocolError from '../src/domain/errors/GitProtocolError.js';
import InvalidArgumentError from '../src/domain/errors/InvalidArgumentError.js';
import UnsupportedCapabilityError from '../src/domain/errors/UnsupportedCapabilityError.js';

const DECODER = new TextDecoder();

function scriptedSession(output) {
  let finish;
  let terminateCalls = 0;
  let stdoutController;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  const session = new CommandSession({
    stdoutStream: new ReadableStream({
      start(controller) {
        stdoutController = controller;
        controller.enqueue(new TextEncoder().encode(output));
      },
    }),
    finished,
    write: async () => {},
    closeInput: async () => {},
    terminate: () => {
      terminateCalls += 1;
      stdoutController.close();
      finish({ code: 1, stderr: '', terminated: true, timedOut: false });
    },
  });
  return { session, terminateCalls: () => terminateCalls };
}

function gatedSession(output, releaseAfterWrites, { gateTermination = false } = {}) {
  let finish;
  let released = false;
  let releaseTermination;
  let signalTerminationStarted;
  let terminateCalls = 0;
  let stdoutController;
  const writes = [];
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  const terminationStarted = new Promise((resolve) => {
    signalTerminationStarted = resolve;
  });
  const terminationRelease = new Promise((resolve) => {
    releaseTermination = resolve;
  });
  const session = new CommandSession({
    stdoutStream: new ReadableStream({
      start(controller) {
        stdoutController = controller;
      },
    }),
    finished,
    write: async (bytes) => {
      writes.push(new Uint8Array(bytes));
      if (!released && writes.length === releaseAfterWrites) {
        released = true;
        stdoutController.enqueue(new TextEncoder().encode(output));
      }
    },
    closeInput: async () => {
      stdoutController.close();
      finish({ code: 0, stderr: '', terminated: false, timedOut: false });
    },
    terminate: () => {
      terminateCalls += 1;
      const finishTermination = () => {
        stdoutController.close();
        finish({ code: 1, stderr: '', terminated: true, timedOut: false });
      };
      if (gateTermination) {
        signalTerminationStarted();
        void terminationRelease.then(finishTermination);
      } else {
        finishTermination();
      }
    },
  });
  return {
    session,
    writes,
    releaseTermination,
    terminationStarted,
    terminateCalls: () => terminateCalls,
  };
}

describe('long-lived Git protocol sessions', () => {
  let git;
  let repoPath;
  let firstOid;
  let secondOid;

  beforeAll(async () => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-session-'));
    git = await GitPlumbing.createDefault({ cwd: repoPath });
    await git.execute({ args: ['init', '--bare'] });
    firstOid = await git.execute({
      args: ['hash-object', '-w', '--stdin'],
      input: 'first object',
    });
    secondOid = await git.execute({
      args: ['hash-object', '-w', '--stdin'],
      input: 'second object',
    });
  });

  afterAll(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  it('reads repeated and pipelined objects through one cat-file process', async () => {
    const reader = await git.openCatFileSession();
    const first = await reader.read(firstOid);
    const metadata = await reader.info(secondOid);
    const metadataBatch = await reader.infoMany([firstOid, secondOid, firstOid]);
    const objects = await reader.readMany([firstOid, secondOid, firstOid]);

    expect(DECODER.decode(first.content)).toBe('first object');
    expect(metadata).toMatchObject({ oid: secondOid, type: 'blob', size: 13 });
    expect(metadataBatch.map(({ oid, size }) => ({ oid, size }))).toEqual([
      { oid: firstOid, size: 12 },
      { oid: secondOid, size: 13 },
      { oid: firstOid, size: 12 },
    ]);
    expect(objects.map((object) => DECODER.decode(object.content))).toEqual([
      'first object',
      'second object',
      'first object',
    ]);
    await reader.close();
    await reader.close();
  });

  it('pipelines ordered metadata batches before consuming responses', async () => {
    const output = `${firstOid} blob 12\n${secondOid} blob 13\n`;
    const scripted = gatedSession(output, 1);
    const reader = new GitCatFileSession(scripted.session);

    await expect(reader.infoMany([firstOid, secondOid])).resolves.toEqual([
      { oid: firstOid, type: 'blob', size: 12 },
      { oid: secondOid, type: 'blob', size: 13 },
    ]);
    expect(scripted.writes).toHaveLength(1);
    expect(DECODER.decode(scripted.writes[0])).toBe(`info ${firstOid}\ninfo ${secondOid}\nflush\n`);
    await reader.close();
  });

  it('snapshots metadata batch names before the operation is queued', async () => {
    const output = `${firstOid} blob 12\n${secondOid} blob 13\n`;
    const scripted = gatedSession(output, 1);
    const reader = new GitCatFileSession(scripted.session);
    const objectNames = [firstOid, secondOid];

    try {
      const metadata = reader.infoMany(objectNames);
      objectNames.pop();

      await expect(metadata).resolves.toEqual([
        { oid: firstOid, type: 'blob', size: 12 },
        { oid: secondOid, type: 'blob', size: 13 },
      ]);
    } finally {
      await reader.close();
    }
  });

  it('snapshots content batch names before the operation is queued', async () => {
    const output = `${firstOid} blob 1\na\n${secondOid} blob 1\nb\n`;
    const scripted = gatedSession(output, 1);
    const reader = new GitCatFileSession(scripted.session);
    const objectNames = [firstOid, secondOid];

    try {
      const objects = reader.readMany(objectNames, { maxBytes: 2 });
      objectNames.pop();

      await expect(
        objects.then((values) => values.map(({ content }) => DECODER.decode(content)))
      ).resolves.toEqual(['a', 'b']);
    } finally {
      await reader.close();
    }
  });

  it('drains a failed cat-file batch and remains usable', async () => {
    const reader = await git.openCatFileSession();
    const missingOid = '0'.repeat(firstOid.length);

    await expect(reader.readMany([firstOid, missingOid, secondOid])).rejects.toBeInstanceOf(
      GitObjectMissingError
    );
    await expect(reader.infoMany([firstOid, missingOid, secondOid])).rejects.toBeInstanceOf(
      GitObjectMissingError
    );
    await expect(reader.info(secondOid)).resolves.toMatchObject({ oid: secondOid });
    await expect(reader.read(secondOid)).resolves.toMatchObject({ oid: secondOid });
    await expect(reader.read('invalid object name')).rejects.toBeInstanceOf(InvalidArgumentError);
    await reader.close();
  });

  it('enforces cumulative cat-file buffer and batch bounds without desynchronizing', async () => {
    const reader = await git.openCatFileSession();

    await expect(reader.read(firstOid, { maxBytes: 4 })).rejects.toMatchObject({
      details: { code: 'OBJECT_BUFFER_LIMIT_EXCEEDED', maxBytes: 4 },
    });
    await expect(reader.read(secondOid)).resolves.toMatchObject({ oid: secondOid });
    await expect(reader.readMany([firstOid, secondOid], { maxBytes: 20 })).rejects.toMatchObject({
      details: { code: 'OBJECT_BUFFER_LIMIT_EXCEEDED', maxBytes: 8 },
    });
    await expect(reader.read(firstOid)).resolves.toMatchObject({ oid: firstOid });
    await expect(
      reader.readMany(Array.from({ length: 1001 }, () => firstOid))
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(
      reader.readMany(Array.from({ length: 9 }, () => 'a'.repeat(8192)))
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(reader.read(secondOid)).resolves.toMatchObject({ oid: secondOid });
    await reader.close();
  });

  it('poisons a cat-file session when batch draining finds malformed protocol', async () => {
    const missingOid = '0'.repeat(firstOid.length);
    const malformedOid = '1'.repeat(firstOid.length);
    const scripted = scriptedSession(`${missingOid} missing\nnot-an-oid blob 1\n`);
    const reader = new GitCatFileSession(scripted.session);
    const readResponse = reader._readResponse.bind(reader);
    let readCalls = 0;
    reader._readResponse = async (...args) => {
      readCalls += 1;
      return await readResponse(...args);
    };

    await expect(reader.readMany([missingOid, malformedOid, firstOid])).rejects.toBeInstanceOf(
      GitObjectMissingError
    );
    expect(scripted.terminateCalls()).toBe(1);
    expect(readCalls).toBe(2);
    await expect(reader.read(firstOid)).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('poisons a metadata batch when draining finds malformed protocol', async () => {
    const missingOid = '0'.repeat(firstOid.length);
    const malformedOid = '1'.repeat(firstOid.length);
    const scripted = scriptedSession(`${missingOid} missing\nnot-an-oid blob 1\n`);
    const reader = new GitCatFileSession(scripted.session);

    await expect(reader.infoMany([missingOid, malformedOid, firstOid])).rejects.toBeInstanceOf(
      GitObjectMissingError
    );
    expect(scripted.terminateCalls()).toBe(1);
    await expect(reader.info(firstOid)).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('poisons metadata batches that contain non-protocol whitespace', async () => {
    const scripted = gatedSession(` ${firstOid} blob 12\n`, 1);
    const reader = new GitCatFileSession(scripted.session);

    await expect(reader.infoMany([firstOid])).rejects.toBeInstanceOf(GitProtocolError);
    expect(scripted.terminateCalls()).toBe(1);
  });

  it('writes NUL-framed trees through one mktree process', async () => {
    const writer = await git.openMktreeSession();
    expect(writer).toBeInstanceOf(GitMktreeSession);
    async function* entries() {
      yield { mode: '100644', type: 'blob', oid: firstOid, name: 'line\nwith-tab\t.txt' };
      yield { mode: '100644', type: 'blob', oid: secondOid, name: 'second.txt' };
    }
    const firstTree = await writer.write(entries());
    const emptyTree = await writer.write([]);
    const batchTrees = await writer.writeMany([
      [{ mode: '100644', type: 'blob', oid: firstOid, name: 'batch.txt' }],
      [],
    ]);

    await writer.close();
    await writer.close();
    await expect(git.execute({ args: ['cat-file', '-t', firstTree] })).resolves.toBe('tree');
    await expect(git.execute({ args: ['cat-file', '-t', emptyTree] })).resolves.toBe('tree');
    await expect(
      Promise.all(batchTrees.map((oid) => git.execute({ args: ['cat-file', '-t', oid] })))
    ).resolves.toEqual(['tree', 'tree']);
    await expect(writer.write([])).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('pipelines bounded tree batches before consuming ordered OIDs', async () => {
    const firstTree = 'a'.repeat(firstOid.length);
    const secondTree = 'b'.repeat(firstOid.length);
    const scripted = gatedSession(`${firstTree}\n${secondTree}\n`, 1);
    const writer = new GitMktreeSession(scripted.session);
    const trees = [
      [{ mode: '100644', type: 'blob', oid: firstOid, name: 'first' }],
      [{ mode: '100644', type: 'blob', oid: secondOid, name: 'second' }],
    ];

    await expect(writer.writeMany(trees)).resolves.toEqual([firstTree, secondTree]);
    expect(scripted.writes).toHaveLength(1);
    await writer.close();
  });

  it('snapshots the outer tree batch before the operation is queued', async () => {
    const firstTree = 'a'.repeat(firstOid.length);
    const secondTree = 'b'.repeat(firstOid.length);
    const scripted = gatedSession(`${firstTree}\n${secondTree}\n`, 1);
    const writer = new GitMktreeSession(scripted.session);
    const trees = [[]];

    try {
      const writing = writer.writeMany(trees);
      trees.push([]);

      await expect(writing).resolves.toEqual([firstTree]);
    } finally {
      await writer.close();
    }
  });

  it('poisons a tree batch after a malformed ordered response', async () => {
    const firstTree = 'a'.repeat(firstOid.length);
    const scripted = gatedSession(`${firstTree}\nnot-an-oid\n`, 1);
    const writer = new GitMktreeSession(scripted.session);

    await expect(writer.writeMany([[], []])).rejects.toBeInstanceOf(GitProtocolError);
    expect(scripted.terminateCalls()).toBe(1);
    await expect(writer.write([])).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('rejects invalid tree mode/type pairs before changing protocol state', async () => {
    const writer = await git.openMktreeSession();
    await expect(
      writer.write([{ mode: '100755', type: 'tree', oid: firstOid, name: 'invalid' }])
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(
      writer.write([{ mode: '100644', type: 'blob', oid: firstOid, name: 'valid' }])
    ).resolves.toMatch(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
    await expect(writer.writeMany(Array.from({ length: 257 }, () => []))).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
    await expect(
      writer.writeMany([
        [{ mode: '100644', type: 'blob', oid: firstOid, name: 'valid' }],
        [{ mode: '100755', type: 'tree', oid: firstOid, name: 'invalid' }],
      ])
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(writer.writeMany([[]])).resolves.toHaveLength(1);
    await writer.close();
  });

  it('checkpoints and completes blobs through one fast-import process', async () => {
    const writer = await git.openFastImportSession();
    expect(writer).toBeInstanceOf(GitFastImportSession);
    const checkpointedOid = await writer.writeBlob('checkpointed object');
    const batchedOids = await writer.writeBlobs([
      'first batched object',
      new TextEncoder().encode('second batched object'),
    ]);

    await writer.checkpoint();
    await expect(git.execute({ args: ['cat-file', '-p', checkpointedOid] })).resolves.toBe(
      'checkpointed object'
    );
    await expect(
      Promise.all(batchedOids.map((oid) => git.execute({ args: ['cat-file', '-p', oid] })))
    ).resolves.toEqual(['first batched object', 'second batched object']);

    const completedOid = await writer.writeBlob(new TextEncoder().encode('completed object'));
    await writer.close();
    await writer.close();
    await expect(git.execute({ args: ['cat-file', '-p', completedOid] })).resolves.toBe(
      'completed object'
    );
    await expect(writer.writeBlob('late')).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('streams one unbounded blob without duplicating its content buffer', async () => {
    const oid = 'a'.repeat(firstOid.length);
    const scripted = gatedSession(`${oid}\n`, 1);
    const writer = new GitFastImportSession(scripted.session);
    const content = Uint8Array.of(1, 2, 3);

    try {
      await expect(writer.writeBlob(content)).resolves.toBe(oid);
      expect(scripted.writes).toHaveLength(3);
      expect(DECODER.decode(scripted.writes[0])).toBe('blob\nmark :1\ndata 3\n');
      expect(scripted.writes[1]).toEqual(content);
      expect(DECODER.decode(scripted.writes[2])).toBe('\nget-mark :1\n');
    } finally {
      await writer.close();
    }
  });

  it('pipelines bounded blob batches before consuming ordered marks', async () => {
    const firstBlob = 'a'.repeat(firstOid.length);
    const secondBlob = 'b'.repeat(firstOid.length);
    const scripted = gatedSession(`${firstBlob}\n${secondBlob}\n`, 1);
    const writer = new GitFastImportSession(scripted.session);

    await expect(writer.writeBlobs(['first', Uint8Array.of(1, 2)])).resolves.toEqual([
      firstBlob,
      secondBlob,
    ]);
    expect(scripted.writes).toHaveLength(1);
    await writer.close();
  });

  it('poisons a blob batch after a malformed ordered response', async () => {
    const firstBlob = 'a'.repeat(firstOid.length);
    const scripted = gatedSession(`${firstBlob}\nnot-an-oid\n`, 1);
    const writer = new GitFastImportSession(scripted.session);

    await expect(writer.writeBlobs(['first', 'second'])).rejects.toBeInstanceOf(GitProtocolError);
    expect(scripted.terminateCalls()).toBe(1);
    await expect(writer.writeBlob('late')).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('rejects invalid blob batches before changing protocol state', async () => {
    const writer = await git.openFastImportSession();

    await expect(
      writer.writeBlobs(Array.from({ length: 257 }, () => 'blob'))
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(writer.writeBlobs(['too large'], { maxBytes: 4 })).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
    await expect(writer.writeBlobs(['still usable'])).resolves.toHaveLength(1);
    await writer.close();
  });

  it('preserves batch identity in a SHA-256 repository', async () => {
    const shaRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-plumbing-sha256-batch-'));
    try {
      const shaGit = await GitPlumbing.createDefault({ cwd: shaRepo });
      await shaGit.execute({ args: ['init', '--bare', '--object-format=sha256'] });
      const blobs = await shaGit.openFastImportSession();
      const blobOids = await blobs.writeBlobs(['sha256 first', 'sha256 second']);
      await blobs.checkpoint();
      await blobs.close();

      const trees = await shaGit.openMktreeSession();
      const treeOids = await trees.writeMany(
        blobOids.map((oid, index) => [
          {
            mode: '100644',
            type: 'blob',
            oid,
            name: `blob-${index}`,
          },
        ])
      );
      await trees.close();

      const objects = await shaGit.openCatFileSession();
      const metadata = await objects.infoMany([...blobOids, ...treeOids]);
      const contents = await objects.readMany(blobOids);
      await objects.close();

      const refs = await shaGit.openUpdateRefSession();
      await refs.update({
        ref: 'refs/plumbing/sha256-session',
        newOid: treeOids[0],
        expectedOldOid: null,
      });
      await refs.update({
        ref: 'refs/plumbing/sha256-session',
        newOid: treeOids[1],
        expectedOldOid: treeOids[0],
        noDeref: true,
      });
      await refs.close();

      expect(metadata.map(({ oid }) => oid)).toEqual([...blobOids, ...treeOids]);
      expect(metadata.every(({ oid }) => oid.length === 64)).toBe(true);
      expect(contents.map(({ content }) => DECODER.decode(content))).toEqual([
        'sha256 first',
        'sha256 second',
      ]);
      await expect(
        shaGit.execute({
          args: ['rev-parse', 'refs/plumbing/sha256-session'],
        })
      ).resolves.toBe(treeOids[1]);
    } finally {
      fs.rmSync(shaRepo, { recursive: true, force: true });
    }
  });

  it('reuses one update-ref process across explicit CAS transactions', async () => {
    const writer = await git.openUpdateRefSession();
    expect(writer).toBeInstanceOf(GitUpdateRefSession);

    await writer.update({
      ref: 'refs/plumbing/reusable-session',
      newOid: firstOid,
      expectedOldOid: null,
    });
    await writer.update({
      ref: 'refs/plumbing/reusable-session',
      newOid: secondOid,
      expectedOldOid: firstOid,
      noDeref: true,
    });
    await writer.close();
    await writer.close();

    await expect(
      git.execute({
        args: ['rev-parse', 'refs/plumbing/reusable-session'],
      })
    ).resolves.toBe(secondOid);
  });

  it('frames one write per acknowledged ref transaction', async () => {
    const statuses = 'start: ok\nprepare: ok\ncommit: ok\n'.repeat(2);
    const scripted = gatedSession(statuses, 1);
    const writer = new GitUpdateRefSession(scripted.session);

    await writer.update({ ref: 'refs/plumbing/test', newOid: firstOid, expectedOldOid: null });
    await writer.update({
      ref: 'refs/plumbing/test',
      newOid: secondOid,
      expectedOldOid: firstOid,
      noDeref: true,
    });

    expect(scripted.writes).toHaveLength(2);
    expect(DECODER.decode(scripted.writes[0])).toBe(
      `start\nupdate refs/plumbing/test ${firstOid} ${'0'.repeat(firstOid.length)}\nprepare\ncommit\n`
    );
    expect(DECODER.decode(scripted.writes[1])).toBe(
      `start\noption no-deref\nupdate refs/plumbing/test ${secondOid} ${firstOid}\nprepare\ncommit\n`
    );
    await writer.close();
  });

  it('rejects invalid ref transactions before changing protocol state', async () => {
    const scripted = gatedSession('start: ok\nprepare: ok\ncommit: ok\n', 1);
    const writer = new GitUpdateRefSession(scripted.session);

    await expect(
      writer.update({
        ref: 'refs/plumbing/bad ref',
        newOid: firstOid,
      })
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(
      writer.update({
        ref: 'refs/plumbing/test',
        newOid: firstOid,
        expectedOldOid: 'a'.repeat(64),
      })
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(
      writer.update({
        ref: 'refs/plumbing/trailing/',
        newOid: firstOid,
      })
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(scripted.writes).toHaveLength(0);
    await expect(
      writer.update({
        ref: 'refs/plumbing/test',
        newOid: firstOid,
        expectedOldOid: null,
      })
    ).resolves.toBeUndefined();
    expect(scripted.writes).toHaveLength(1);
    await writer.close();
  });

  it('poisons a ref session after malformed acknowledgement', async () => {
    const scripted = gatedSession('start: ok\nprepare: nope\n', 1);
    const writer = new GitUpdateRefSession(scripted.session);

    await expect(
      writer.update({
        ref: 'refs/plumbing/test',
        newOid: firstOid,
        expectedOldOid: null,
      })
    ).rejects.toBeInstanceOf(GitProtocolError);
    expect(scripted.terminateCalls()).toBe(1);
    await expect(
      writer.update({
        ref: 'refs/plumbing/test',
        newOid: secondOid,
        expectedOldOid: firstOid,
      })
    ).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('preserves a ref transaction failure when close runs during cleanup', async () => {
    const scripted = gatedSession('start: ok\nprepare: nope\n', 1, {
      gateTermination: true,
    });
    const writer = new GitUpdateRefSession(scripted.session);
    const update = writer.update({
      ref: 'refs/plumbing/test',
      newOid: firstOid,
      expectedOldOid: null,
    });

    await scripted.terminationStarted;
    const close = writer.close();
    scripted.releaseTermination();

    await expect(update).rejects.toMatchObject({
      operation: 'GitUpdateRefSession.update',
      details: { response: 'prepare: nope', stage: 'prepare' },
    });
    await expect(close).resolves.toBeUndefined();
    expect(scripted.terminateCalls()).toBe(1);
    await writer.close();
  });

  it('poisons a ref session after Git rejects compare-and-swap', async () => {
    const writer = await git.openUpdateRefSession();
    await writer.update({
      ref: 'refs/plumbing/rejected-session',
      newOid: firstOid,
      expectedOldOid: null,
    });

    let rejection;
    try {
      await writer.update({
        ref: 'refs/plumbing/rejected-session',
        newOid: secondOid,
        expectedOldOid: secondOid,
      });
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(GitProtocolError);
    expect(Number.isInteger(rejection.details.result.code)).toBe(true);
    await expect(
      writer.update({
        ref: 'refs/plumbing/rejected-session',
        newOid: secondOid,
        expectedOldOid: firstOid,
      })
    ).rejects.toBeInstanceOf(GitProtocolError);
  });

  it('settles timeout and termination exactly once', async () => {
    const timed = await git.openSession({
      args: ['cat-file', '--batch-command'],
      timeout: 50,
    });
    const timedResult = await timed.finished;

    expect(timedResult.timedOut).toBe(true);
    expect(timedResult.code).not.toBe(0);
    timed.terminate();
    timed.terminate();

    const terminated = await git.openSession({ args: ['cat-file', '--batch-command'] });
    terminated.terminate();
    terminated.terminate();
    const terminatedResult = await terminated.finished;
    expect(terminatedResult.terminated).toBe(true);
  });

  it('reports invalid session options through the structured plumbing boundary', async () => {
    const args = ['cat-file', '--batch-command'];

    await expect(git.openSession({ args, timeout: 0 })).rejects.toMatchObject({
      name: 'GitPlumbingError',
      operation: 'GitPlumbing.openSession',
      details: { args },
    });
  });

  it('reports early exit and bounded stderr without hanging', async () => {
    const session = await git.openSession({
      args: ['hash-object', '--invalid-flag'],
      maxStderrBytes: 16,
    });
    await session.closeInput();
    const result = await session.finished;

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('[stderr truncated at 16 bytes]');
    await expect(session.write('late')).rejects.toBeInstanceOf(GitPlumbingError);
    await session.stdout.destroy();
  });

  it('fails closed when a custom one-shot runner lacks session support', async () => {
    const custom = await GitPlumbing.createDefault({
      cwd: repoPath,
      runner: async () => ({
        stdoutStream: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exitPromise: Promise.resolve({ code: 0, stderr: '' }),
      }),
    });

    await expect(custom.openCatFileSession()).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });
});
