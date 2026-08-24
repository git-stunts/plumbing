import GitProtocolError from '../../domain/errors/GitProtocolError.js';
import GitPlumbingError from '../../domain/errors/GitPlumbingError.js';
import GitObjectMissingError from '../../domain/errors/GitObjectMissingError.js';
import InvalidArgumentError from '../../domain/errors/InvalidArgumentError.js';
import { DEFAULT_MAX_BUFFER_SIZE } from '../../ports/RunnerOptionsSchema.js';
import ByteReader from '../ByteReader.js';

const DECODER = new TextDecoder();
const MAX_BATCH_OBJECTS = 1000;
const MAX_BATCH_COMMAND_BYTES = 64 * 1024;
const MAX_OBJECT_NAME_BYTES = 8192;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const OBJECT_TYPES = new Set(['blob', 'tree', 'commit', 'tag']);
const ENCODER = new TextEncoder();

/**
 * Typed client for one `git cat-file --batch-command` process.
 */
export default class GitCatFileSession {
  /**
   * @param {import('../CommandSession.js').default} session
   * @param {Object} [options]
   * @param {boolean} [options.buffered=true]
   */
  constructor(session, { buffered = true } = {}) {
    this._session = session;
    this._reader = new ByteReader(session.stdout);
    this._buffered = buffered;
    this._closed = false;
    this._closePromise = null;
    this._tail = Promise.resolve();
  }

  /**
   * Reads object metadata without loading its content.
   * @param {string} objectName
   * @returns {Promise<{oid: string, type: string, size: number}>}
   */
  async info(objectName) {
    validateObjectName(objectName, 'GitCatFileSession.info');
    return await this._serialize(async () => {
      await this._send(`info ${objectName}\n`);
      return this._parseInfo(DECODER.decode(await this._reader.readLine()), objectName);
    });
  }

  /**
   * Pipelines a bounded group of metadata reads.
   * @param {string[]} objectNames
   * @returns {Promise<ReadonlyArray<{oid: string, type: string, size: number}>>}
   */
  async infoMany(objectNames) {
    const batch = buildBatchCommand(
      objectNames,
      'info',
      'GitCatFileSession.infoMany'
    );
    if (batch.objectNames.length === 0) {
      return Object.freeze([]);
    }
    return await this._serialize(async () => {
      await this._send(batch.command);
      const objects = [];
      for (let index = 0; index < batch.objectNames.length; index += 1) {
        try {
          const line = DECODER.decode(await this._reader.readLine());
          objects.push(this._parseInfo(line, batch.objectNames[index]));
        } catch (error) {
          await this._drainInfoBatch(batch.objectNames, index + 1);
          throw error;
        }
      }
      return Object.freeze(objects);
    });
  }

  /**
   * Reads one complete object.
   * @param {string} objectName
   * @param {Object} [options]
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE]
   * @returns {Promise<{oid: string, type: string, size: number, content: Uint8Array}>}
   */
  async read(objectName, { maxBytes = DEFAULT_MAX_BUFFER_SIZE } = {}) {
    validateObjectName(objectName, 'GitCatFileSession.read');
    validateMaxBytes(maxBytes, 'GitCatFileSession.read');
    return await this._serialize(async () => {
      await this._send(`contents ${objectName}\n`);
      return await this._readResponse(objectName, maxBytes);
    });
  }

  /**
   * Pipelines a bounded group of complete-object reads.
   * @param {string[]} objectNames
   * @param {Object} [options]
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE] Total content budget.
   * @returns {Promise<ReadonlyArray<{oid: string, type: string, size: number, content: Uint8Array}>>}
   */
  async readMany(objectNames, { maxBytes = DEFAULT_MAX_BUFFER_SIZE } = {}) {
    const batch = buildBatchCommand(
      objectNames,
      'contents',
      'GitCatFileSession.readMany'
    );
    validateMaxBytes(maxBytes, 'GitCatFileSession.readMany');
    if (batch.objectNames.length === 0) {
      return Object.freeze([]);
    }
    return await this._serialize(async () => {
      await this._send(batch.command);
      const objects = [];
      let remainingBytes = maxBytes;
      for (let index = 0; index < batch.objectNames.length; index += 1) {
        try {
          const object = await this._readResponse(batch.objectNames[index], remainingBytes);
          objects.push(object);
          remainingBytes -= object.size;
        } catch (error) {
          for (
            let remaining = index + 1;
            remaining < batch.objectNames.length;
            remaining += 1
          ) {
            if (this._closed) {
              break;
            }
            try {
              await this._readResponse(batch.objectNames[remaining], 0);
            } catch (drainError) {
              if (!isRecoverableReadError(drainError)) {
                await this.terminate();
              }
              // Preserve the first request failure after draining or poisoning.
            }
          }
          throw error;
        }
      }
      return Object.freeze(objects);
    });
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
        assertSuccessfulExit(await this._session.finished, 'GitCatFileSession.close');
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

  async _readResponse(objectName, maxBytes) {
    const info = this._parseInfo(DECODER.decode(await this._reader.readLine()), objectName);
    if (info.size > maxBytes) {
      await this._reader.discardExactly(info.size);
      await this._readTerminator(objectName);
      throw new GitPlumbingError(
        `Git object exceeds the remaining buffer budget: ${info.size} > ${maxBytes}`,
        'GitCatFileSession._readResponse',
        {
          code: 'OBJECT_BUFFER_LIMIT_EXCEEDED',
          maxBytes,
          objectName,
          size: info.size,
        }
      );
    }
    const content = await this._reader.readExactly(info.size);
    await this._readTerminator(objectName);
    return Object.freeze({ ...info, content });
  }

  async _drainInfoBatch(objectNames, startIndex) {
    for (let index = startIndex; index < objectNames.length; index += 1) {
      if (this._closed) {
        return;
      }
      try {
        const line = DECODER.decode(await this._reader.readLine());
        this._parseInfo(line, objectNames[index]);
      } catch (error) {
        if (!isRecoverableReadError(error)) {
          await this.terminate();
          return;
        }
      }
    }
  }

  async _readTerminator(objectName) {
    const terminator = await this._reader.readExactly(1);
    if (terminator[0] !== 0x0a) {
      throw new GitProtocolError(
        `cat-file response for ${objectName} is missing its terminator`,
        'GitCatFileSession._readResponse',
        { objectName }
      );
    }
  }

  _parseInfo(line, objectName) {
    const fields = line.split(' ');
    if (fields.length === 2 && fields[1] === 'missing') {
      throw new GitObjectMissingError(objectName, 'GitCatFileSession._parseInfo');
    }
    const size = Number(fields[2]);
    if (
      fields.length !== 3 ||
      !OBJECT_ID.test(fields[0]) ||
      !OBJECT_TYPES.has(fields[1]) ||
      !Number.isSafeInteger(size) ||
      size < 0
    ) {
      throw new GitProtocolError(
        `Malformed cat-file response: ${JSON.stringify(line)}`,
        'GitCatFileSession._parseInfo',
        { objectName }
      );
    }
    return Object.freeze({ oid: fields[0], type: fields[1], size });
  }

  async _send(command) {
    await this._session.write(this._buffered ? `${command}flush\n` : command);
  }

  async _serialize(operation) {
    if (this._closed) {
      throw new GitProtocolError('cat-file session is closed', 'GitCatFileSession._serialize');
    }
    const current = this._tail.then(async () => {
      try {
        return await operation();
      } catch (error) {
        if (!isRecoverableReadError(error)) {
          await this.terminate();
        }
        throw error;
      }
    });
    this._tail = current.catch(() => {});
    return await current;
  }
}

function isRecoverableReadError(error) {
  return (
    error instanceof GitObjectMissingError ||
    error?.details?.code === 'OBJECT_BUFFER_LIMIT_EXCEEDED'
  );
}

function validateObjectName(objectName, operation) {
  if (
    typeof objectName !== 'string' ||
    objectName.length === 0 ||
    /[\s\0]/u.test(objectName) ||
    ENCODER.encode(objectName).length > MAX_OBJECT_NAME_BYTES
  ) {
    throw new InvalidArgumentError('Invalid Git object name', operation, { objectName });
  }
}

function buildBatchCommand(objectNames, verb, operation) {
  if (!Array.isArray(objectNames)) {
    throw new InvalidArgumentError('objectNames must be an array', operation);
  }
  const snapshot = Object.freeze([...objectNames]);
  for (const objectName of snapshot) {
    validateObjectName(objectName, operation);
  }
  if (snapshot.length > MAX_BATCH_OBJECTS) {
    throw new InvalidArgumentError(
      `A cat-file batch may contain at most ${MAX_BATCH_OBJECTS} objects`,
      operation,
      { count: snapshot.length, maxObjects: MAX_BATCH_OBJECTS }
    );
  }
  const command = snapshot.map((name) => `${verb} ${name}\n`).join('');
  const commandBytes = ENCODER.encode(command).length;
  if (commandBytes > MAX_BATCH_COMMAND_BYTES) {
    throw new InvalidArgumentError(
      `A cat-file batch command may contain at most ${MAX_BATCH_COMMAND_BYTES} bytes`,
      operation,
      { commandBytes, maxBytes: MAX_BATCH_COMMAND_BYTES }
    );
  }
  return Object.freeze({ command, objectNames: snapshot });
}

function validateMaxBytes(maxBytes, operation) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new InvalidArgumentError('maxBytes must be a positive safe integer', operation, {
      maxBytes,
    });
  }
}

function assertSuccessfulExit(result, operation) {
  if (result.code !== 0) {
    throw new GitProtocolError(`git cat-file exited ${result.code}: ${result.stderr}`, operation, {
      result,
    });
  }
}
