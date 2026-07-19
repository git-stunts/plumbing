import GitProtocolError from '../domain/errors/GitProtocolError.js';

const ENCODER = new TextEncoder();
const DEFAULT_MAX_LINE_BYTES = 64 * 1024;

/**
 * Reads exact byte windows and newline-delimited records from one stream.
 */
export default class ByteReader {
  /**
   * @param {AsyncIterable<Uint8Array>} stream
   */
  constructor(stream) {
    this._chunks = [];
    this._headOffset = 0;
    this._bufferedBytes = 0;
    this._iterator = stream[Symbol.asyncIterator]();
    this._closed = false;
  }

  /**
   * @param {number} length
   * @returns {Promise<Uint8Array>}
   */
  async readExactly(length) {
    await this._fill(length);
    const result = new Uint8Array(length);
    this._consume(length, result);
    return result;
  }

  /**
   * Consumes a byte window without retaining it.
   * @param {number} length
   * @returns {Promise<void>}
   */
  async discardExactly(length) {
    let remaining = length;
    while (remaining > 0) {
      if (this._bufferedBytes === 0) {
        await this._readChunk();
      }
      const consumed = Math.min(remaining, this._bufferedBytes);
      this._consume(consumed);
      remaining -= consumed;
    }
  }

  /**
   * @param {number} [maxBytes=DEFAULT_MAX_LINE_BYTES]
   * @returns {Promise<Uint8Array>}
   */
  async readLine(maxBytes = DEFAULT_MAX_LINE_BYTES) {
    while (true) {
      const newline = this._indexOf(0x0a);
      if (newline !== -1) {
        if (newline > maxBytes) {
          throw this._lineLimitError(maxBytes);
        }
        const result = new Uint8Array(newline);
        this._consume(newline, result);
        this._consume(1);
        return result;
      }
      if (this._bufferedBytes > maxBytes) {
        throw this._lineLimitError(maxBytes);
      }
      await this._readChunk();
    }
  }

  /**
   * Releases the underlying stream iterator. Repeated calls are harmless.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    if (typeof this._iterator.return === 'function') {
      await this._iterator.return();
    }
    this._chunks = [];
    this._headOffset = 0;
    this._bufferedBytes = 0;
  }

  async _fill(length) {
    while (this._bufferedBytes < length) {
      await this._readChunk();
    }
  }

  async _readChunk() {
    if (this._closed) {
      throw new GitProtocolError('Git response reader is closed', 'ByteReader._readChunk');
    }
    const next = await this._iterator.next();
    if (next.done) {
      throw new GitProtocolError(
        'Git process closed before completing its response',
        'ByteReader._readChunk'
      );
    }
    const chunk =
      next.value instanceof Uint8Array ? next.value : ENCODER.encode(String(next.value));
    if (chunk.length === 0) {
      return;
    }
    this._chunks.push(chunk);
    this._bufferedBytes += chunk.length;
  }

  _consume(length, output) {
    let remaining = length;
    let outputOffset = 0;
    while (remaining > 0) {
      const head = this._chunks[0];
      const available = head.length - this._headOffset;
      const consumed = Math.min(remaining, available);
      if (output !== undefined) {
        output.set(head.subarray(this._headOffset, this._headOffset + consumed), outputOffset);
        outputOffset += consumed;
      }
      this._headOffset += consumed;
      this._bufferedBytes -= consumed;
      remaining -= consumed;
      if (this._headOffset === head.length) {
        this._chunks.shift();
        this._headOffset = 0;
      }
    }
  }

  _indexOf(byte) {
    let offset = 0;
    for (let index = 0; index < this._chunks.length; index += 1) {
      const chunk = this._chunks[index];
      const start = index === 0 ? this._headOffset : 0;
      const found = chunk.indexOf(byte, start);
      if (found !== -1) {
        return offset + found - start;
      }
      offset += chunk.length - start;
    }
    return -1;
  }

  _lineLimitError(maxBytes) {
    return new GitProtocolError(
      `Git protocol line exceeds ${maxBytes} bytes`,
      'ByteReader.readLine',
      { maxBytes }
    );
  }
}
