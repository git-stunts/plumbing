import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import NodeShellRunner from '../src/infrastructure/adapters/node/NodeShellRunner.js';
import CommandSession from '../src/infrastructure/CommandSession.js';
import GitFastImportSession from '../src/infrastructure/protocols/GitFastImportSession.js';

// Medium: real Node streams, controlled process events, no subprocess or clock.
// Oracle: closing session input settles once that input is closed. A process
// may close stdin without Writable's successful-flush `finish` event.
class ControlledChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.inputEnding = new Promise((resolve) => {
      this.stdin = new Writable({
        write(_bytes, _encoding, done) {
          done();
        },
        final(done) {
          resolve(done);
        },
      });
    });
  }

  exit(code = 0) {
    this.stdin.destroy();
    this.stdout.end();
    this.stderr.end();
    this.emit('close', code, null);
  }
}

function observe(promise) {
  const outcome = { status: 'pending' };
  promise.then(
    () => Object.assign(outcome, { status: 'fulfilled' }),
    (error) => Object.assign(outcome, { status: 'rejected', error })
  );
  return outcome;
}

async function openSession(child) {
  const runner = new NodeShellRunner({ spawnProcess: () => child });
  return await runner.open({ command: 'git', args: [], maxStderrBytes: 1024 });
}

describe('Node command session input lifecycle', () => {
  it('settles input closure when the child closes stdin without finishing it', async () => {
    const child = new ControlledChild();
    const session = await openSession(child);
    const outcome = observe(session.closeInput());
    await child.inputEnding;

    child.exit();
    const result = await session.finished;
    // Drain stream event dispatch and promise continuations, not elapsed time.
    await nextTurn();

    assert.equal(result.code, 0);
    assert.equal(child.stdin.destroyed, true);
    assert.equal(child.stdin.writableFinished, false);
    assert.deepEqual(
      outcome,
      { status: 'fulfilled' },
      'closeInput must settle after stdin closes and the child has completed'
    );
  });

  it('settles input closure after a successful final flush', async () => {
    const child = new ControlledChild();
    const session = await openSession(child);
    const outcome = observe(session.closeInput());
    const finishInput = await child.inputEnding;

    finishInput();
    await nextTurn();

    assert.deepEqual(outcome, { status: 'fulfilled' });
    assert.equal(child.stdin.writableFinished, true);
    assert.equal(child.stdin.listenerCount('close'), 0, 'closure listeners must be released');
    child.exit();
    await session.finished;
  });

  it('preserves an input error when the stream closes during shutdown', async () => {
    const child = new ControlledChild();
    const session = await openSession(child);
    const failure = new Error('injected stdin failure');
    const outcome = observe(session.closeInput());
    await child.inputEnding;

    child.stdin.destroy(failure);
    await nextTurn();

    assert.deepEqual(outcome, { status: 'rejected', error: failure });
    assert.equal(child.stdin.listenerCount('finish'), 0, 'closure listeners must be released');
    assert.equal(child.stdin.listenerCount('close'), 0, 'closure listeners must be released');
    await assert.rejects(session.closeInput(), (error) => error === failure);
    child.exit(1);
    await session.finished;
  });

  for (const exitCode of [0, 1]) {
    it(`settles fast-import shutdown with the child's exit code ${exitCode}`, async () => {
      const child = new ControlledChild();
      const raw = await openSession(child);
      const writer = new GitFastImportSession(new CommandSession(raw));
      const outcome = observe(writer.close());
      await child.inputEnding;

      child.exit(exitCode);
      await raw.finished;
      await nextTurn();

      assert.equal(
        outcome.status,
        exitCode === 0 ? 'fulfilled' : 'rejected',
        'fast-import close must settle after its child closes stdin'
      );
      if (exitCode !== 0) {
        assert.equal(outcome.error.details.result.code, exitCode);
      }
      assert.equal(child.stdin.listenerCount('finish'), 0, 'closure listeners must be released');
      assert.equal(child.stdin.listenerCount('close'), 0, 'closure listeners must be released');
    });
  }
});
