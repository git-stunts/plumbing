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
          // If the stream was destroyed/ended unexpectedly
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
   * Collects the entire stream into a string, with a safety limit on bytes.
   * @param {Object} options
   * @param {number} [options.maxBytes=DEFAULT_MAX_BUFFER_SIZE]
   * @returns {Promise<string>}
   * @throws {Error} If maxBytes is exceeded.
   */
  async collect({ maxBytes = DEFAULT_MAX_BUFFER_SIZE } = {}) {
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let result = '';

    for await (const chunk of this) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      
      if (totalBytes + bytes.length > maxBytes) {
        throw new Error(`Buffer limit exceeded: ${maxBytes} bytes`);
      }

      totalBytes += bytes.length;
      result += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
    }

    return result;
  }

  /**
   * Implements the Async Iterable protocol
   */
  async *[Symbol.asyncIterator]() {
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
  }
}
