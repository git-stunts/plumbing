import { SessionRunnerResultSchema } from '../src/ports/SessionRunnerResultSchema.js';

function sessionResult(finished) {
  return {
    stdoutStream: new ReadableStream(),
    finished,
    write: () => {},
    closeInput: () => {},
    terminate: () => {},
  };
}

describe('SessionRunnerResultSchema', () => {
  it('parses synchronously and validates the completion when it settles', async () => {
    const parsed = SessionRunnerResultSchema.parse(
      sessionResult(Promise.resolve({ code: 0, stderr: '', timedOut: false, pid: 7 }))
    );

    expect(await parsed.finished).toEqual({ code: 0, stderr: '', timedOut: false, pid: 7 });
  });

  it('rejects the settled completion when it is malformed', async () => {
    const parsed = SessionRunnerResultSchema.parse(sessionResult(Promise.resolve({ code: 'x' })));

    await expect(parsed.finished).rejects.toThrow();
  });

  it('rejects a non-thenable completion immediately', () => {
    expect(() => SessionRunnerResultSchema.parse(sessionResult(42))).toThrow('Expected a promise');
  });

  it('preserves a rejected completion through a re-parse', async () => {
    const failure = new Error('completion failed');
    const once = SessionRunnerResultSchema.parse(sessionResult(Promise.reject(failure)));

    await expect(SessionRunnerResultSchema.parse(once).finished).rejects.toBe(failure);
  });

  it('can re-parse an already parsed result', async () => {
    const once = SessionRunnerResultSchema.parse(
      sessionResult(Promise.resolve({ code: 1, stderr: 'boom', timedOut: false }))
    );

    expect((await SessionRunnerResultSchema.parse(once).finished).code).toBe(1);
  });
});
