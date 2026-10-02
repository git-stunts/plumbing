import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import {
  CommandSession,
  GitMktreeSession,
  GitPlumbingError,
  GitProtocolError,
} from '../index.js';

const ENTRY = { mode: '100644', type: 'blob', oid: 'b'.repeat(40), name: 'content' };

function command(failure) {
  let finish;
  let terminations = 0;
  const finished = new Promise((resolve) => { finish = resolve; });
  const session = new CommandSession({
    stdoutStream: Readable.from([]),
    finished,
    write: async () => { if (failure !== null) { throw failure; } },
    closeInput: async () => { finish({ code: 0, stderr: '', terminated: false, timedOut: false }); },
    terminate: () => {
      terminations += 1;
      finish({ code: 1, stderr: '', terminated: true, timedOut: false });
    },
  });
  return { session, terminations: () => terminations };
}

function brokenPipe() {
  return Object.assign(new Error('broken pipe'), { code: 'EPIPE' });
}

describe('mktree closed transport classification', () => {
  it.each(['single', 'batch'])('classifies a broken pipe in %s writes and releases the process', async (mode) => {
    const cause = brokenPipe();
    const fixture = command(cause);
    const writer = new GitMktreeSession(fixture.session);
    const request = mode === 'single' ? writer.write([ENTRY]) : writer.writeMany([[ENTRY]]);
    await expect(request).rejects.toBeInstanceOf(GitProtocolError);
    await expect(request).rejects.toMatchObject({ details: { cause } });
    expect(fixture.terminations()).toBe(1);
  });

  it('classifies already-closed input regardless of notification ordering', async () => {
    const cause = new GitPlumbingError('input closed', 'write', { code: 'SESSION_INPUT_CLOSED' });
    const fixture = command(cause);
    const writer = new GitMktreeSession(fixture.session);
    await expect(writer.write([ENTRY])).rejects.toMatchObject({
      name: 'GitProtocolError', details: { code: 'GIT_PROTOCOL_ERROR', cause },
    });
    expect(fixture.terminations()).toBe(1);
  });

  it('preserves unrelated transport failures', async () => {
    const cause = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const fixture = command(cause);
    const writer = new GitMktreeSession(fixture.session);
    await expect(writer.write([ENTRY])).rejects.toBe(cause);
    expect(fixture.terminations()).toBe(1);
  });

  it('preserves a plumbing failure with explicitly absent details', async () => {
    const cause = new GitPlumbingError('original failure', 'write', null);
    const fixture = command(cause);
    const writer = new GitMktreeSession(fixture.session);
    await expect(writer.write([ENTRY])).rejects.toBe(cause);
    expect(fixture.terminations()).toBe(1);
  });

  it.each(['single', 'batch'])('preserves a producer failure with an identical system error code in %s writes', async (mode) => {
    const cause = brokenPipe();
    const fixture = command(null);
    const writer = new GitMktreeSession(fixture.session);
    async function* entries() { yield ENTRY; throw cause; }
    const request = mode === 'single' ? writer.write(entries()) : writer.writeMany([entries()]);
    await expect(request).rejects.toBe(cause);
    expect(fixture.terminations()).toBe(mode === 'single' ? 1 : 0);
  });
});
