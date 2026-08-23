import GitProtocolError from '../../domain/errors/GitProtocolError.js';
import InvalidArgumentError from '../../domain/errors/InvalidArgumentError.js';
import ByteReader from '../ByteReader.js';

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();
const MAX_BATCH_BYTES = 64 * 1024 * 1024;
const MAX_BATCH_OBJECTS = 256;

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
    const bytes = encodeBlob(content, 'GitFastImportSession.writeBlob');
    return await this._serialize(async () => {
      const mark = this._nextMark;
      this._nextMark += 1;
      await this._session.write(encodeBlobRequest(bytes, mark));
      return await this._readOid();
    });
  }

  /**
   * Pipelines one bounded blob group and returns OIDs in input order.
   * Objects become externally visible after checkpoint() or close().
   * @param {Array<string|Uint8Array>} contents
   * @param {Object} [options]
   * @param {number} [options.maxBytes=MAX_BATCH_BYTES]
   * @returns {Promise<ReadonlyArray<string>>}
   */
  async writeBlobs(contents, { maxBytes = MAX_BATCH_BYTES } = {}) {
    const blobs = prepareBlobBatch(contents, maxBytes);
    if (blobs.length === 0) {
      return Object.freeze([]);
    }
    return await this._serialize(async () => {
      const firstMark = this._nextMark;
      const chunks = [];
      for (let index = 0; index < blobs.length; index += 1) {
        chunks.push(...encodeBlobRequestChunks(blobs[index], firstMark + index));
      }
      this._nextMark += blobs.length;
      await this._session.write(concatBytes(chunks));
      const oids = [];
      for (let index = 0; index < blobs.length; index += 1) {
        oids.push(await this._readOid());
      }
      return Object.freeze(oids);
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

function encodeBlob(content, operation) {
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    throw new InvalidArgumentError('Blob content must be a string or Uint8Array', operation);
  }
  return typeof content === 'string' ? ENCODER.encode(content) : content;
}

function encodeBlobRequest(bytes, mark) {
  return concatBytes(encodeBlobRequestChunks(bytes, mark));
}

function encodeBlobRequestChunks(bytes, mark) {
  return [
    ENCODER.encode(`blob\nmark :${mark}\ndata ${bytes.length}\n`),
    bytes,
    ENCODER.encode(`\nget-mark :${mark}\n`),
  ];
}

function concatBytes(chunks) {
  const totalBytes = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function prepareBlobBatch(contents, maxBytes) {
  if (!Array.isArray(contents)) {
    throw new InvalidArgumentError(
      'contents must be an array',
      'GitFastImportSession.writeBlobs'
    );
  }
  if (contents.length > MAX_BATCH_OBJECTS) {
    throw new InvalidArgumentError(
      `A fast-import batch may contain at most ${MAX_BATCH_OBJECTS} blobs`,
      'GitFastImportSession.writeBlobs',
      { count: contents.length, maxObjects: MAX_BATCH_OBJECTS }
    );
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BATCH_BYTES) {
    throw new InvalidArgumentError(
      `maxBytes must be between 1 and ${MAX_BATCH_BYTES}`,
      'GitFastImportSession.writeBlobs',
      { maxBytes }
    );
  }
  const blobs = contents.map((content) =>
    encodeBlob(content, 'GitFastImportSession.writeBlobs')
  );
  const totalBytes = blobs.reduce((total, bytes) => total + bytes.length, 0);
  if (totalBytes > maxBytes) {
    throw new InvalidArgumentError(
      `Fast-import batch content exceeds ${maxBytes} bytes`,
      'GitFastImportSession.writeBlobs',
      { maxBytes, totalBytes }
    );
  }
  return blobs;
}
