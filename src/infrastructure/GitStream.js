/**
 * @fileoverview Universal wrapper for Node.js and Web Streams
 */

import { DEFAULT_MAX_BUFFER_SIZE } from '../ports/RunnerOptionsSchema.js';

/**
 * GitStream provides a unified interface for consuming command output
 * across Node.js, Bun, and Deno runtimes.
 */
export default class GitStream {
  /**
   * @param {ReadableStream|import('node:stream').Readable} stream
   * @param {Promise<{code: number, stderr: string}>} [exitPromise]
   */
  constructor(stream, exitPromise = Promise.resolve({ code: 0, stderr: '' })) {
    this._stream = stream;
    this.finished = exitPromise;
    this._consumed = false;
  }

  /**
   * Returns a reader compatible with the Web Streams API.
   * Favor native async iteration for Node.js streams to avoid manual listener management.
   * @returns {{read: function(): Promise<{done: boolean, value: any}>, releaseLock: function(): void}}
   */
  getReader() {
    if (typeof this._stream.getReader === 'function') {
      return this._stream.getReader();
    }

    // Node.js stream adapter using async iterator
    const it = this._stream[Symbol.asyncIterator]();

    return {
      read: async () => {
        try {
          const { done, value } = await it.next();
          return { done, value };
        } catch (err) {
          /**
           * Handle premature close in Node.js.
           * This happens if the underlying process exits or is killed before the stream ends.
           */
          if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
            return { done: true, value: undefined };
          }
          throw err;
        }
      },
      releaseLock: () => {}
    };
  }

  /**
   * Collects the entire stream into a Uint8Array or string, with a safety limit on bytes.
   * Uses an array of chunks to avoid redundant allocations.
   * @param {Object} options
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE]
   * @param {boolean} [options.asString=false] - Whether to decode the final buffer to a string.
   * @param {string} [options.encoding='utf-8'] - The encoding to use if asString is true.
   * @returns {Promise<Uint8Array|string>}
   * @throws {Error} If maxBytes is exceeded.
   */
  async collect({ maxBytes = DEFAULT_MAX_BUFFER_SIZE, asString = false, encoding = 'utf-8' } = {}) {
    const chunks = [];
    let totalBytes = 0;

    try {
      for await (const chunk of this) {
        // Optimized: Check for Uint8Array to avoid redundant encoding
        const bytes = chunk instanceof Uint8Array ? chunk : new TextEncoder().encode(String(chunk));
        
        if (totalBytes + bytes.length > maxBytes) {
          throw new Error(`Buffer limit exceeded: ${maxBytes} bytes`);
        }

        chunks.push(bytes);
        totalBytes += bytes.length;
      }

      const result = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      if (asString) {
        return new TextDecoder(encoding).decode(result);
      }

      return result;
    } finally {
      await this.destroy();
    }
  }

  /**
   * Implements the Async Iterable protocol
   */
  async *[Symbol.asyncIterator]() {
    if (this._consumed) {
      throw new Error('Stream has already been consumed');
    }
    this._consumed = true;

    try {
      // Favor native async iterator if available (Node 10+, Deno, Bun)
      if (typeof this._stream[Symbol.asyncIterator] === 'function') {
        yield* this._stream;
        return;
      }

      // Fallback to reader-based iteration
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      await this.destroy();
    }
  }

  /**
   * Closes the underlying stream and releases resources.
   * @returns {Promise<void>}
   */
  async destroy() {
    try {
      if (typeof this._stream.destroy === 'function') {
        this._stream.destroy();
      } else if (typeof this._stream.cancel === 'function') {
        await this._stream.cancel();
      }
    } catch {
      // Ignore errors during destruction
    }
  }
}
