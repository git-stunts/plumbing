/**
 * @fileoverview Universal wrapper for Node.js and Web Streams
 */

/**
 * GitStream provides a unified interface for consuming command output
 * across Node.js, Bun, and Deno runtimes.
 */
export default class GitStream {
  /**
   * @param {ReadableStream|import('node:stream').Readable} stream
   */
  constructor(stream) {
    this._stream = stream;
  }

  /**
   * Returns a reader compatible with the Web Streams API
   * @returns {{read: function(): Promise<{done: boolean, value: any}>, releaseLock: function(): void}}
   */
  getReader() {
    if (typeof this._stream.getReader === 'function') {
      return this._stream.getReader();
    }

    // Polyfill reader for Node.js Readable streams
    const stream = this._stream;
    let ended = false;

    return {
      read: async () => {
        if (ended) {
          return { done: true, value: undefined };
        }

        return new Promise((resolve, reject) => {
          const onData = (chunk) => {
            cleanup();
            resolve({ done: false, value: chunk });
          };
          const onEnd = () => {
            ended = true;
            cleanup();
            resolve({ done: true, value: undefined });
          };
          const onError = (err) => {
            cleanup();
            reject(err);
          };

          const cleanup = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
          };

          stream.on('data', onData);
          stream.on('end', onEnd);
          stream.on('error', onError);

          // Try to read immediately if data is buffered
          const chunk = stream.read();
          if (chunk !== null) {
            onData(chunk);
          }
        });
      },
      releaseLock: () => {
        // Node streams don't have locking semantics like Web Streams
      }
    };
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
