import GitProtocolError from '../../domain/errors/GitProtocolError.js';
import InvalidArgumentError from '../../domain/errors/InvalidArgumentError.js';
import ByteReader from '../ByteReader.js';

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();
const MODE_TYPES = new Map([
  ['040000', 'tree'],
  ['100644', 'blob'],
  ['100755', 'blob'],
  ['120000', 'blob'],
  ['160000', 'commit'],
]);
const MAX_TREE_NAME_BYTES = 8192;
const MAX_BATCH_BYTES = 64 * 1024 * 1024;
const MAX_BATCH_ENTRIES = 65_536;
const MAX_BATCH_TREES = 256;
const NUL = Uint8Array.of(0);

/**
 * Typed client for one `git mktree --batch -z` process.
 */
export default class GitMktreeSession {
  /**
   * @param {import('../CommandSession.js').default} session
   */
  constructor(session) {
    this._session = session;
    this._reader = new ByteReader(session.stdout);
    this._closed = false;
    this._closePromise = null;
    this._tail = Promise.resolve();
  }

  /**
   * Writes one tree from structured entries.
   * @param {Iterable<{mode: string, type: string, oid: string, name: string}>|AsyncIterable<{mode: string, type: string, oid: string, name: string}>} entries
   * @returns {Promise<string>}
   */
  async write(entries) {
    validateEntries(entries);
    return await this._serialize(async () => {
      let protocolStarted = false;
      try {
        for await (const entry of entries) {
          const record = encodeEntry(entry);
          const framed = new Uint8Array(record.length + 1);
          framed.set(record);
          protocolStarted = true;
          await this._session.write(framed);
        }
        protocolStarted = true;
        await this._session.write(NUL);
        return await this._readOid('GitMktreeSession.write');
      } catch (error) {
        if (protocolStarted) {
          await this.terminate();
        }
        throw error;
      }
    });
  }

  /**
   * Pipelines a bounded group of independent tree writes.
   * @param {Array<Iterable<{mode: string, type: string, oid: string, name: string}>|AsyncIterable<{mode: string, type: string, oid: string, name: string}>>} trees
   * @returns {Promise<ReadonlyArray<string>>}
   */
  async writeMany(trees) {
    const batch = validateTrees(trees);
    if (batch.length === 0) {
      return Object.freeze([]);
    }
    return await this._serialize(async () => {
      let protocolStarted = false;
      try {
        const payload = await prepareTreeBatch(batch);
        protocolStarted = true;
        await this._session.write(payload);
        const oids = [];
        for (let index = 0; index < batch.length; index += 1) {
          oids.push(await this._readOid('GitMktreeSession.writeMany'));
        }
        return Object.freeze(oids);
      } catch (error) {
        if (protocolStarted) {
          await this.terminate();
        }
        throw error;
      }
    });
  }

  async _readOid(operation) {
    const oid = DECODER.decode(await this._reader.readLine());
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oid)) {
      throw new GitProtocolError(
        `git mktree returned an invalid object identifier: ${oid}`,
        operation
      );
    }
    return oid;
  }

  /**
   * Closes input and verifies orderly process completion.
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
        await this._session.closeInput();
        const result = await this._session.finished;
        if (result.code !== 0) {
          throw new GitProtocolError(
            `git mktree exited ${result.code}: ${result.stderr}`,
            'GitMktreeSession.close',
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
   * Terminates the process without attempting protocol completion.
   * @returns {Promise<void>}
   */
  async terminate() {
    this._closed = true;
    this._session.terminate();
    try {
      await this._session.finished;
    } finally {
      await this._reader.close();
    }
  }

  async _serialize(operation) {
    if (this._closed) {
      throw new GitProtocolError('mktree session is closed', 'GitMktreeSession._serialize');
    }
    const current = this._tail.then(operation);
    this._tail = current.catch(() => {});
    return await current;
  }
}

function validateEntries(entries, operation = 'GitMktreeSession.write') {
  assertEntriesIterable(entries, operation);
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      encodeEntry(entry, operation);
    }
  }
}

function assertEntriesIterable(entries, operation) {
  const isIterable =
    entries !== null &&
    typeof entries === 'object' &&
    (typeof entries[Symbol.iterator] === 'function' ||
      typeof entries[Symbol.asyncIterator] === 'function');
  if (!isIterable) {
    throw new InvalidArgumentError('entries must be iterable', operation);
  }
}

function encodeEntry(entry, operation = 'GitMktreeSession.write') {
  if (typeof entry !== 'object' || entry === null) {
    throw new InvalidArgumentError('Tree entry must be an object', operation);
  }
  const { mode, type, oid, name } = entry;
  if (MODE_TYPES.get(mode) !== type) {
    throw new InvalidArgumentError('Tree entry mode or type is invalid', operation, {
      entry,
    });
  }
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oid)) {
    throw new InvalidArgumentError('Tree entry OID is invalid', operation, {
      entry,
    });
  }
  if (typeof name !== 'string' || name.length === 0 || name.includes('\0') || name.includes('/')) {
    throw new InvalidArgumentError('Tree entry name is invalid', operation, {
      entry,
    });
  }
  const header = ENCODER.encode(`${mode} ${type} ${oid}\t`);
  const encodedName = ENCODER.encode(name);
  if (encodedName.length > MAX_TREE_NAME_BYTES) {
    throw new InvalidArgumentError('Tree entry name is too long', operation, {
      maxBytes: MAX_TREE_NAME_BYTES,
      nameBytes: encodedName.length,
    });
  }
  const record = new Uint8Array(header.length + encodedName.length);
  record.set(header, 0);
  record.set(encodedName, header.length);
  return record;
}

function validateTrees(trees) {
  if (!Array.isArray(trees)) {
    throw new InvalidArgumentError('trees must be an array', 'GitMktreeSession.writeMany');
  }
  const snapshot = Object.freeze([...trees]);
  if (snapshot.length > MAX_BATCH_TREES) {
    throw new InvalidArgumentError(
      `A mktree batch may contain at most ${MAX_BATCH_TREES} trees`,
      'GitMktreeSession.writeMany',
      { count: snapshot.length, maxTrees: MAX_BATCH_TREES }
    );
  }
  return snapshot;
}

async function prepareTreeBatch(trees) {
  const chunks = [];
  let totalBytes = 0;
  let totalEntries = 0;
  for (const entries of trees) {
    assertEntriesIterable(entries, 'GitMktreeSession.writeMany');
    for await (const entry of entries) {
      const record = encodeEntry(entry, 'GitMktreeSession.writeMany');
      totalEntries += 1;
      totalBytes += record.length + 1;
      validateBatchTotals(totalEntries, totalBytes);
      chunks.push(record, NUL);
    }
    totalBytes += 1;
    validateBatchTotals(totalEntries, totalBytes);
    chunks.push(NUL);
  }
  return concatBytes(chunks, totalBytes);
}

function concatBytes(chunks, totalBytes) {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function validateBatchTotals(entries, bytes) {
  if (entries > MAX_BATCH_ENTRIES || bytes > MAX_BATCH_BYTES) {
    throw new InvalidArgumentError(
      'A mktree batch exceeds its bounded input limits',
      'GitMktreeSession.writeMany',
      {
        bytes,
        entries,
        maxBytes: MAX_BATCH_BYTES,
        maxEntries: MAX_BATCH_ENTRIES,
      }
    );
  }
}
