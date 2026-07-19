/**
 * Collects a byte stream into bounded UTF-8 text.
 */
const ENCODER = new TextEncoder();

export default class BoundedTextCollector {
  /**
   * @param {number} maxBytes
   */
  constructor(maxBytes) {
    this.maxBytes = maxBytes;
  }

  /**
   * @param {AsyncIterable<Uint8Array>|ReadableStream<Uint8Array>} stream
   * @returns {Promise<string>}
   */
  async collect(stream) {
    const chunks = [];
    let remaining = this.maxBytes;
    let truncated = false;
    for await (const chunk of stream) {
      const bytes = chunk instanceof Uint8Array ? chunk : ENCODER.encode(String(chunk));
      const acceptedLength = Math.min(bytes.length, remaining);
      if (remaining > 0) {
        const accepted = bytes.slice(0, acceptedLength);
        chunks.push(accepted);
        remaining -= accepted.length;
      }
      if (acceptedLength < bytes.length) {
        truncated = true;
      }
    }
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder().decode(output);
    return truncated ? `${text}\n[stderr truncated at ${this.maxBytes} bytes]` : text;
  }
}
