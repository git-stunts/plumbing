import CommandSession from '../src/infrastructure/CommandSession.js';
import BoundedTextCollector from '../src/infrastructure/BoundedTextCollector.js';
import ByteReader from '../src/infrastructure/ByteReader.js';
import GitPlumbingError from '../src/domain/errors/GitPlumbingError.js';

const DECODER = new TextDecoder();

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function emptyStream() {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

describe('CommandSession', () => {
  it('serializes writes and waits for accepted writes before closing input', async () => {
    const firstWrite = deferred();
    const completion = deferred();
    const calls = [];
    let closeCalls = 0;
    const session = new CommandSession({
      stdoutStream: emptyStream(),
      finished: completion.promise,
      write: async (bytes) => {
        const value = DECODER.decode(bytes);
        calls.push(value);
        if (value === 'first') {
          await firstWrite.promise;
        }
      },
      closeInput: async () => {
        closeCalls += 1;
        calls.push('close');
      },
      terminate: () => {},
    });

    const first = session.write('first');
    const second = session.write('second');
    const close = session.closeInput();
    await Promise.resolve();

    expect(calls).toEqual(['first']);
    firstWrite.resolve();
    await Promise.all([first, second, close]);
    await session.closeInput();

    expect(calls).toEqual(['first', 'second', 'close']);
    expect(closeCalls).toBe(1);
    await expect(session.write('late')).rejects.toMatchObject({
      details: { code: 'SESSION_INPUT_CLOSED' },
    });
    completion.resolve({ code: 0, stderr: '' });
    await session.finished;
  });

  it('closes input after a write failure', async () => {
    const completion = deferred();
    let terminateCalls = 0;
    let writeCalls = 0;
    const session = new CommandSession({
      stdoutStream: emptyStream(),
      finished: completion.promise,
      write: async () => {
        writeCalls += 1;
        throw new Error('write failed');
      },
      closeInput: async () => {},
      terminate: () => {
        terminateCalls += 1;
      },
    });

    const first = session.write('first');
    const second = session.write('second');
    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    expect(firstResult).toMatchObject({
      status: 'rejected',
      reason: { message: 'write failed' },
    });
    expect(secondResult).toMatchObject({ status: 'rejected' });
    expect(secondResult.reason).toBeInstanceOf(GitPlumbingError);
    expect(writeCalls).toBe(1);
    expect(terminateCalls).toBe(1);
    completion.resolve({ code: 1, stderr: 'failed', terminated: true });
    await session.finished;
  });

  it('terminates when closing input fails', async () => {
    const completion = deferred();
    let terminateCalls = 0;
    const session = new CommandSession({
      stdoutStream: emptyStream(),
      finished: completion.promise,
      write: async () => {},
      closeInput: async () => {
        throw new Error('close failed');
      },
      terminate: () => {
        terminateCalls += 1;
      },
    });

    expect(session.stdout.finished).toBe(session.finished);
    await expect(session.closeInput()).rejects.toThrow('close failed');
    expect(terminateCalls).toBe(1);
    completion.resolve({ code: 1, stderr: '', terminated: true });
    await session.finished;
  });

  it('terminates at most once', async () => {
    const completion = deferred();
    let terminateCalls = 0;
    const session = new CommandSession({
      stdoutStream: emptyStream(),
      finished: completion.promise,
      write: async () => {},
      closeInput: async () => {},
      terminate: () => {
        terminateCalls += 1;
      },
    });

    session.terminate();
    session.terminate();

    expect(terminateCalls).toBe(1);
    await expect(session.write('late')).rejects.toBeInstanceOf(GitPlumbingError);
    completion.resolve({ code: 1, stderr: '', terminated: true });
    await session.finished;
  });
});

describe('BoundedTextCollector', () => {
  it('does not mark fully retained chunks as truncated', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345678'));
        controller.close();
      },
    });

    await expect(new BoundedTextCollector(10).collect(stream)).resolves.toBe('12345678');
  });

  it('retains only the configured byte window and marks truncation', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345678'));
        controller.enqueue(new TextEncoder().encode('90more'));
        controller.close();
      },
    });

    await expect(new BoundedTextCollector(10).collect(stream)).resolves.toBe(
      '1234567890\n[stderr truncated at 10 bytes]'
    );
  });
});

describe('ByteReader', () => {
  it('reads and discards fragmented byte windows without concatenating the stream', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('abc'));
        controller.enqueue(new TextEncoder().encode('def\n12'));
        controller.enqueue(new TextEncoder().encode('3456'));
        controller.close();
      },
    });
    const reader = new ByteReader(stream);

    expect(DECODER.decode(await reader.readExactly(2))).toBe('ab');
    expect(DECODER.decode(await reader.readLine())).toBe('cdef');
    await reader.discardExactly(2);
    expect(DECODER.decode(await reader.readExactly(4))).toBe('3456');
    await reader.close();
    await reader.close();
  });

  it('rejects an overlong protocol line', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345\n'));
        controller.close();
      },
    });
    const reader = new ByteReader(stream);

    await expect(reader.readLine(4)).rejects.toMatchObject({
      details: { code: 'GIT_PROTOCOL_ERROR', maxBytes: 4 },
    });
    await reader.close();
  });
});
