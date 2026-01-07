
import GitFileMode from '../../../src/domain/value-objects/GitFileMode.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';

describe('GitFileMode', () => {
  describe('constructor', () => {
    it('creates a valid GitFileMode', () => {
      const mode = new GitFileMode(GitFileMode.REGULAR);
      expect(mode.toString()).toBe('100644');
    });

    it('throws ValidationError for invalid mode', () => {
      expect(() => new GitFileMode('999999')).toThrow(ValidationError);
    });
  });

  describe('is methods', () => {
    it('correctly identifies tree', () => {
      const mode = new GitFileMode(GitFileMode.TREE);
      expect(mode.isTree()).toBe(true);
      expect(mode.isRegular()).toBe(false);
    });

    it('correctly identifies regular file', () => {
      const mode = new GitFileMode(GitFileMode.REGULAR);
      expect(mode.isRegular()).toBe(true);
      expect(mode.isExecutable()).toBe(false);
    });
  });
});
