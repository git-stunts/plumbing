import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import GitPlumbing, {
  CommandSession,
  GitCatFileSession,
  GitFastImportSession,
  GitMktreeSession,
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
    const objects = await reader.readMany([firstOid, secondOid, firstOid]);

    expect(DECODER.decode(first.content)).toBe('first object');
    expect(metadata).toMatchObject({ oid: secondOid, type: 'blob', size: 13 });
    expect(objects.map((object) => DECODER.decode(object.content))).toEqual([
      'first object',
      'second object',
      'first object',
    ]);
    await reader.close();
    await reader.close();
  });

  it('drains a failed cat-file batch and remains usable', async () => {
    const reader = await git.openCatFileSession();
    const missingOid = '0'.repeat(firstOid.length);

    await expect(reader.readMany([firstOid, missingOid, secondOid])).rejects.toBeInstanceOf(
      GitObjectMissingError
    );
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

  it('writes NUL-framed trees through one mktree process', async () => {
    const writer = await git.openMktreeSession();
    expect(writer).toBeInstanceOf(GitMktreeSession);
    async function* entries() {
      yield { mode: '100644', type: 'blob', oid: firstOid, name: 'line\nwith-tab\t.txt' };
      yield { mode: '100644', type: 'blob', oid: secondOid, name: 'second.txt' };
    }
    const firstTree = await writer.write(entries());
    const emptyTree = await writer.write([]);

    await writer.close();
    await writer.close();
    await expect(git.execute({ args: ['cat-file', '-t', firstTree] })).resolves.toBe('tree');
    await expect(git.execute({ args: ['cat-file', '-t', emptyTree] })).resolves.toBe('tree');
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
    await writer.close();
  });

  it('checkpoints and completes blobs through one fast-import process', async () => {
    const writer = await git.openFastImportSession();
    expect(writer).toBeInstanceOf(GitFastImportSession);
    const checkpointedOid = await writer.writeBlob('checkpointed object');

    await writer.checkpoint();
    await expect(git.execute({ args: ['cat-file', '-p', checkpointedOid] })).resolves.toBe(
      'checkpointed object'
    );

    const completedOid = await writer.writeBlob(new TextEncoder().encode('completed object'));
    await writer.close();
    await writer.close();
    await expect(git.execute({ args: ['cat-file', '-p', completedOid] })).resolves.toBe(
      'completed object'
    );
    await expect(writer.writeBlob('late')).rejects.toBeInstanceOf(GitProtocolError);
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
