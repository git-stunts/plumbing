import GitProtocolError from '../../domain/errors/GitProtocolError.js';
import InvalidArgumentError from '../../domain/errors/InvalidArgumentError.js';
import ByteReader from '../ByteReader.js';

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

/**
 * Blob writer backed by one `git fast-import` process.
 */
export default class GitFastImportSession {
  /**
   * @param {import('../CommandSession.js').default} session
   */
  constructor(session) {
    this._session = session;
    this._reader = new ByteReader(session.stdout);
    this._closed = false;
    this._closePromise = null;
    this._nextMark = 1;
    this._nextCheckpoint = 1;
    this._tail = Promise.resolve();
  }

  /**
   * Writes one blob and returns its object identifier.
   * The object becomes externally visible after checkpoint() or close().
   * @param {string|Uint8Array} content
   * @returns {Promise<string>}
   */
  async writeBlob(content) {
    if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
      throw new InvalidArgumentError(
        'Blob content must be a string or Uint8Array',
        'GitFastImportSession.writeBlob'
      );
    }
    const bytes = typeof content === 'string' ? ENCODER.encode(content) : content;
    return await this._serialize(async () => {
      const mark = this._nextMark;
      this._nextMark += 1;
      await this._session.write(`blob\nmark :${mark}\ndata ${bytes.length}\n`);
      await this._session.write(bytes);
      await this._session.write(`\nget-mark :${mark}\n`);
      return await this._readOid();
    });
  }

  /**
   * Flushes imported objects without ending the session.
   * @returns {Promise<void>}
   */
  async checkpoint() {
    return await this._serialize(async () => {
      const token = `plumbing-checkpoint-${this._nextCheckpoint}`;
      this._nextCheckpoint += 1;
      await this._session.write(`checkpoint\nprogress ${token}\n`);
      const response = DECODER.decode(await this._reader.readLine());
      if (response !== `progress ${token}`) {
        throw new GitProtocolError(
          `Unexpected fast-import checkpoint response: ${response}`,
          'GitFastImportSession.checkpoint',
          { token }
        );
      }
    });
  }

  /**
   * Completes the import and verifies orderly process completion.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._closePromise !== null) {
      return await this._closePromise;
    }
    this._closed = true;
    this._closePromise = (async () => {
      try {
        await this._tail;
        await this._session.write('checkpoint\ndone\n');
        await this._session.closeInput();
        const result = await this._session.finished;
        if (result.code !== 0) {
          throw new GitProtocolError(
            `git fast-import exited ${result.code}: ${result.stderr}`,
            'GitFastImportSession.close',
            { result }
          );
        }
      } finally {
        await this._reader.close();
      }
    })();
    return await this._closePromise;
  }

  /**
   * Terminates without orderly protocol completion.
   * Git may leave unreachable objects for later garbage collection.
   * @returns {Promise<void>}
   */
  async abort() {
    this._closed = true;
    this._session.terminate();
    try {
      await this._session.finished;
    } finally {
      await this._reader.close();
    }
  }

  async _readOid() {
    const oid = DECODER.decode(await this._reader.readLine());
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oid)) {
      throw new GitProtocolError(
        `git fast-import returned an invalid object identifier: ${oid}`,
        'GitFastImportSession._readOid'
      );
    }
    return oid;
  }

  async _serialize(operation) {
    if (this._closed) {
      throw new GitProtocolError(
        'fast-import session is closed',
        'GitFastImportSession._serialize'
      );
    }
    const current = this._tail.then(async () => {
      try {
        return await operation();
      } catch (error) {
        await this.abort();
        throw error;
      }
    });
    this._tail = current.catch(() => {});
    return await current;
  }
}
