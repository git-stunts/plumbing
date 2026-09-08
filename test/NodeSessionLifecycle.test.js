import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import NodeShellRunner from '../src/infrastructure/adapters/node/NodeShellRunner.js';

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
});
