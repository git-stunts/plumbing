
import ByteMeasurer from '../../../src/domain/services/ByteMeasurer.js';

describe('ByteMeasurer', () => {
  it('measures string length in bytes (UTF-8)', () => {
    expect(ByteMeasurer.measure('Hello')).toBe(5);
    expect(ByteMeasurer.measure('🚀')).toBe(4); // Emoji is 4 bytes
  });

  it('measures Uint8Array length', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    expect(ByteMeasurer.measure(data)).toBe(4);
  });
});
