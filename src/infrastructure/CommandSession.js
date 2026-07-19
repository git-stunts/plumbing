import GitStream from './GitStream.js';
import InvalidArgumentError from '../domain/errors/InvalidArgumentError.js';
import GitPlumbingError from '../domain/errors/GitPlumbingError.js';
import { SessionRunnerResultSchema } from '../ports/SessionRunnerResultSchema.js';

const ENCODER = new TextEncoder();

/**
 * A long-lived duplex command with serialized, backpressure-aware input.
 */
export default class CommandSession {
  /**
   * @param {import('../ports/SessionRunnerResultSchema.js').SessionRunnerResult} result
   */
  constructor(result) {
    const parsed = SessionRunnerResultSchema.parse(result);
    this._writeRaw = parsed.write;
    this._closeInputRaw = parsed.closeInput;
    this._terminateRaw = parsed.terminate;
    this._writeTail = Promise.resolve();
    this._closePromise = null;
    this._inputClosed = false;
    this._settled = false;
    this._terminated = false;
    this.stdout = new GitStream(parsed.stdoutStream, parsed.finished);
    this.finished = parsed.finished.then(
      async (result) => {
        this._settled = true;
        this._inputClosed = true;
        if (this._terminated || result.timedOut) {
          await this.stdout.destroy();
        }
        return result;
      },
      async (error) => {
        this._settled = true;
        this._inputClosed = true;
        if (this._terminated) {
          await this.stdout.destroy();
        }
        throw error;
      }
    );
    this.stdout.finished = this.finished;
  }

  /**
   * Writes one complete input chunk after all earlier writes settle.
   * @param {string|Uint8Array} input
   * @returns {Promise<void>}
   */
  async write(input) {
    if (this._inputClosed || this._settled) {
      throw new GitPlumbingError('Command session input is closed', 'CommandSession.write', {
        code: 'SESSION_INPUT_CLOSED',
      });
    }
    if (typeof input !== 'string' && !(input instanceof Uint8Array)) {
      throw new InvalidArgumentError(
        'Session input must be a string or Uint8Array',
        'CommandSession.write'
      );
    }
    const bytes = typeof input === 'string' ? ENCODER.encode(input) : input;
    const operation = this._writeTail.then(async () => {
      if (this._terminated || this._settled) {
        throw new GitPlumbingError('Command session input is closed', 'CommandSession.write', {
          code: 'SESSION_INPUT_CLOSED',
        });
      }
      try {
        await this._writeRaw(bytes);
      } catch (error) {
        this._inputClosed = true;
        try {
          this.terminate();
        } catch {
          // Preserve the write failure as the primary error.
        }
        throw error;
      }
    });
    this._writeTail = operation.catch(() => {});
    await operation;
  }

  /**
   * Closes stdin after every accepted write has settled.
   * @returns {Promise<void>}
   */
  async closeInput() {
    if (this._closePromise !== null) {
      return await this._closePromise;
    }
    if (this._terminated || this._settled) {
      this._inputClosed = true;
      return;
    }
    this._inputClosed = true;
    this._closePromise = this._writeTail.then(async () => {
      try {
        await this._closeInputRaw();
      } catch (error) {
        try {
          this.terminate();
        } catch {
          // Preserve the close failure as the primary error.
        }
        throw error;
      }
    });
    return await this._closePromise;
  }

  /**
   * Terminates the process. Repeated calls are harmless.
   */
  terminate() {
    if (this._terminated || this._settled) {
      return;
    }
    this._terminated = true;
    this._inputClosed = true;
    this._terminateRaw();
  }

  /**
   * Iterates stdout exactly once.
   * @returns {AsyncIterator<Uint8Array>}
   */
  [Symbol.asyncIterator]() {
    return this.stdout[Symbol.asyncIterator]();
  }
}
