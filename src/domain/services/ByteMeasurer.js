/**
 * @fileoverview Domain service for measuring byte size of content
 */

/**
 * Service to measure the byte size of different content types
 */
export default class ByteMeasurer {
  /**
   * Measures the byte length of a string or binary content
   * @param {string|Uint8Array} content
   * @returns {number}
   */
  static measure(content) {
    if (typeof content === 'string') {
      return new TextEncoder().encode(content).length;
    }
    return content.length;
  }
}
