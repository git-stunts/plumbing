/**
 * @fileoverview Domain service for measuring byte size of content
 */

const ENCODER = new TextEncoder();

/**
 * Service to measure the byte size of different content types.
 * Optimized for Node.js, Bun, and Deno runtimes.
 */
export default class ByteMeasurer {
  /**
   * Measures the byte length of a string or binary content.
   * Optimized for Node.js and other runtimes.
   * @param {string|Uint8Array|ArrayBuffer|SharedArrayBuffer|{length: number}} content
   * @returns {number}
   * @throws {TypeError} If the content type is unsupported.
   */
  static measure(content) {
    if (content === null || content === undefined) {
      throw new TypeError('Content cannot be null or undefined');
    }

    if (typeof content === 'string') {
      // Node.js / Bun optimization - fastest way to get UTF-8 byte length without allocation
      if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
        return Buffer.byteLength(content, 'utf8');
      }
      // Fallback for Deno / Browser
      return ENCODER.encode(content).length;
    }

    if (content instanceof Uint8Array) {
      return content.length;
    }

    if (content instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && content instanceof SharedArrayBuffer)) {
      return content.byteLength;
    }

    if (ArrayBuffer.isView(content)) {
      return content.byteLength;
    }

    if (typeof content === 'object' && typeof content.length === 'number' && Number.isFinite(content.length)) {
      return content.length;
    }

    throw new TypeError(`Unsupported content type for ByteMeasurer.measure: ${typeof content}`);
  }
}