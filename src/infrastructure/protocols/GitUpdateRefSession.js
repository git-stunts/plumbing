import GitProtocolError from '../../domain/errors/GitProtocolError.js';
import InvalidArgumentError from '../../domain/errors/InvalidArgumentError.js';
import GitRef from '../../domain/value-objects/GitRef.js';
import ByteReader from '../ByteReader.js';

const DECODER = new TextDecoder();
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

/**
 * Compare-and-swap ref writer backed by one `git update-ref --stdin` process.
 */
export default class GitUpdateRefSession {
  /**
   * @param {import('../CommandSession.js').default} session
   */
  constructor(session) {
    this._session = session;
    this._reader = new ByteReader(session.stdout);
    this._closed = false;
    this._closePromise = null;
    this._terminationPromise = null;
    this._tail = Promise.resolve();
  }

  /**
   * Applies one explicit ref transaction.
   * `null` requires a missing ref; `undefined` omits the old-OID check.
   * @param {Object} options
   * @param {string} options.ref
   * @param {string} options.newOid
   * @param {string|null} [options.expectedOldOid]
   * @param {boolean} [options.noDeref=false]
   * @returns {Promise<void>}
   */
  async update(options) {
    const command = prepareUpdate(options);
    return await this._serialize(async () => {
      await this._session.write(command);
      await this._readStatus('start');
      await this._readStatus('prepare');
      await this._readStatus('commit');
    });
  }

  async _readStatus(stage) {
    const response = DECODER.decode(await this._reader.readLine());
    if (response !== `${stage}: ok`) {
      throw new GitProtocolError(
        `Unexpected update-ref ${stage} response: ${response}`,
        'GitUpdateRefSession.update',
        { response, stage }
      );
    }
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
      await this._tail;
      if (this._terminationPromise !== null) {
        await this._terminationPromise;
        return;
      }
      try {
        await this._session.closeInput();
        const result = await this._session.finished;
        if (result.code !== 0) {
          throw refProcessError(result, 'GitUpdateRefSession.close');
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
    const { cleanupError } = await this._finishTermination();
    if (cleanupError !== null) {
      throw cleanupError;
    }
  }

  async _serialize(operation) {
    if (this._closed) {
      throw new GitProtocolError(
        'update-ref session is closed',
        'GitUpdateRefSession._serialize'
      );
    }
    const current = this._tail.then(async () => {
      try {
        return await operation();
      } catch (error) {
        await this._poison(error);
      }
    });
    this._tail = current.catch(() => {});
    return await current;
  }

  async _poison(error) {
    const { result } = await this._finishTermination();
    if (result !== null && result.code !== 0 && result.stderr.trim() !== '') {
      throw refProcessError(result, 'GitUpdateRefSession.update', error);
    }
    throw error;
  }

  async _finishTermination() {
    if (this._terminationPromise !== null) {
      return await this._terminationPromise;
    }
    this._closed = true;
    this._session.terminate();
    this._terminationPromise = (async () => {
      let result = null;
      let cleanupError = null;
      try {
        result = await this._session.finished;
      } catch (error) {
        cleanupError = error;
      }
      try {
        await this._reader.close();
      } catch (error) {
        cleanupError ??= error;
      }
      return Object.freeze({ cleanupError, result });
    })();
    return await this._terminationPromise;
  }
}

function prepareUpdate(options) {
  if (typeof options !== 'object' || options === null) {
    throw new InvalidArgumentError('options must be an object', 'GitUpdateRefSession.update');
  }
  const { ref, newOid, expectedOldOid, noDeref = false } = options;
  if (!GitRef.isValid(ref)) {
    throw new InvalidArgumentError('Invalid Git reference', 'GitUpdateRefSession.update', { ref });
  }
  if (!OBJECT_ID.test(newOid) || /^0+$/u.test(newOid)) {
    throw new InvalidArgumentError(
      'newOid must be a non-zero SHA-1 or SHA-256 object identifier',
      'GitUpdateRefSession.update',
      { newOid }
    );
  }
  if (typeof noDeref !== 'boolean') {
    throw new InvalidArgumentError('noDeref must be a boolean', 'GitUpdateRefSession.update', {
      noDeref,
    });
  }
  const expected = normalizeExpectedOid(expectedOldOid, newOid.length);
  const oldField = expected === undefined ? '' : ` ${expected}`;
  return [
    'start\n',
    noDeref ? 'option no-deref\n' : '',
    `update ${ref} ${newOid}${oldField}\n`,
    'prepare\n',
    'commit\n',
  ].join('');
}

function normalizeExpectedOid(expectedOldOid, width) {
  if (expectedOldOid === undefined) {
    return undefined;
  }
  if (expectedOldOid === null) {
    return '0'.repeat(width);
  }
  if (!OBJECT_ID.test(expectedOldOid) || expectedOldOid.length !== width) {
    throw new InvalidArgumentError(
      'expectedOldOid must match the new OID width',
      'GitUpdateRefSession.update',
      { expectedOldOid, width }
    );
  }
  return expectedOldOid;
}

function refProcessError(result, operation, originalError) {
  return new GitProtocolError(
    `git update-ref exited ${result.code}: ${result.stderr}`,
    operation,
    { originalError, result }
  );
}
