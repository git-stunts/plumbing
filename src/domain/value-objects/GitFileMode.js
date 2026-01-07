/**
 * @fileoverview GitFileMode value object - represents Git file modes
 */

import GitObjectType from './GitObjectType.js';
import ValidationError from '../errors/ValidationError.js';

/**
 * Represents a Git file mode
 */
export default class GitFileMode {
  static REGULAR = '100644';
  static EXECUTABLE = '100755';
  static SYMLINK = '120000';
  static TREE = '040000';
  static COMMIT = '160000'; // Submodule

  static VALID_MODES = [
    GitFileMode.REGULAR,
    GitFileMode.EXECUTABLE,
    GitFileMode.SYMLINK,
    GitFileMode.TREE,
    GitFileMode.COMMIT
  ];

  /**
   * @param {string} mode
   */
  constructor(mode) {
    if (!GitFileMode.isValid(mode)) {
      throw new ValidationError(`Invalid Git file mode: ${mode}`, 'GitFileMode.constructor', { mode });
    }
    this._value = mode;
  }

  /**
   * Validates if a string is a valid Git file mode
   * @param {string} mode
   * @returns {boolean}
   */
  static isValid(mode) {
    return GitFileMode.VALID_MODES.includes(mode);
  }

  /**
   * Returns the mode as a string
   * @returns {string}
   */
  toString() {
    return this._value;
  }

  /**
   * Returns the corresponding GitObjectType
   * @returns {GitObjectType}
   */
  getObjectType() {
    if (this.isTree()) {
      return GitObjectType.tree();
    }
    if (this._value === GitFileMode.COMMIT) {
      return GitObjectType.commit();
    }
    return GitObjectType.blob();
  }

  /**
   * Checks if this is a directory (tree)
   * @returns {boolean}
   */
  isTree() {
    return this._value === GitFileMode.TREE;
  }

  /**
   * Checks if this is a regular file
   * @returns {boolean}
   */
  isRegular() {
    return this._value === GitFileMode.REGULAR;
  }

  /**
   * Checks if this is an executable file
   * @returns {boolean}
   */
  isExecutable() {
    return this._value === GitFileMode.EXECUTABLE;
  }
}
