/**
 * @fileoverview Domain service for measuring byte size of content
 */

const ENCODER = new TextEncoder();

/**
 * Service to measure the byte size of different content types
 */
export default class ByteMeasurer {
  /**
   * Measures the byte length of a string or binary content.
   * Optimized for Node.js and other runtimes.
   * @param {string|Uint8Array} content
   * @returns {number}
   */
  static measure(content) {
    if (content instanceof Uint8Array) {
      return content.length;
    }

    if (typeof content !== 'string') {
      return 0;
    }

    // Node.js / Bun optimization
    if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
      return Buffer.byteLength(content);
    }

    // Fallback for Deno / Browser
    return ENCODER.encode(content).length;
  }
}
