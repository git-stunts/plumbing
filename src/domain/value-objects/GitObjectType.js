/**
 * @fileoverview GitObjectType value object - represents Git object types
 */

import InvalidGitObjectTypeError from '../errors/InvalidGitObjectTypeError.js';

/**
 * Represents a Git object type
 */
export default class GitObjectType {
  static BLOB_INT = 1;
  static TREE_INT = 2;
  static COMMIT_INT = 3;
  static TAG_INT = 4;
  static OFS_DELTA_INT = 6;
  static REF_DELTA_INT = 7;

  static BLOB = 'blob';
  static TREE = 'tree';
  static COMMIT = 'commit';
  static TAG = 'tag';
  static OFS_DELTA = 'ofs-delta';
  static REF_DELTA = 'ref-delta';

  static TYPE_MAP = {
    [GitObjectType.BLOB_INT]: GitObjectType.BLOB,
    [GitObjectType.TREE_INT]: GitObjectType.TREE,
    [GitObjectType.COMMIT_INT]: GitObjectType.COMMIT,
    [GitObjectType.TAG_INT]: GitObjectType.TAG,
    [GitObjectType.OFS_DELTA_INT]: GitObjectType.OFS_DELTA,
    [GitObjectType.REF_DELTA_INT]: GitObjectType.REF_DELTA
  };

  static STRING_TO_INT = {
    [GitObjectType.BLOB]: GitObjectType.BLOB_INT,
    [GitObjectType.TREE]: GitObjectType.TREE_INT,
    [GitObjectType.COMMIT]: GitObjectType.COMMIT_INT,
    [GitObjectType.TAG]: GitObjectType.TAG_INT,
    [GitObjectType.OFS_DELTA]: GitObjectType.OFS_DELTA,
    [GitObjectType.REF_DELTA]: GitObjectType.REF_DELTA
  };

  /**
   * @param {number} type - Internal type number (1-7)
   */
  constructor(type) {
    if (!GitObjectType.isValid(type)) {
      throw new InvalidGitObjectTypeError(type, 'GitObjectType.constructor');
    }
    this._value = type;
  }

  /**
   * Validates if a number is a valid Git object type
   * @param {number} type
   * @returns {boolean}
   */
  static isValid(type) {
    if (typeof type !== 'number') {return false;}
    return Object.values(GitObjectType.STRING_TO_INT).includes(type);
  }

  /**
   * Creates a GitObjectType from a number, throwing if invalid
   * @param {number} type
   * @returns {GitObjectType}
   */
  static fromNumber(type) {
    return new GitObjectType(type);
  }

  /**
   * Creates a GitObjectType from a string, throwing if invalid
   * @param {string} type
   * @returns {GitObjectType}
   */
  static fromString(type) {
    const typeNumber = GitObjectType.STRING_TO_INT[type];
    if (typeNumber === undefined) {
      throw new InvalidGitObjectTypeError(type, 'GitObjectType.fromString');
    }
    return new GitObjectType(typeNumber);
  }

  /**
   * Returns the object type as a string
   * @returns {string}
   */
  toString() {
    return GitObjectType.TYPE_MAP[this._value];
  }

  /**
   * Returns the object type as a number
   * @returns {number}
   */
  toNumber() {
    return this._value;
  }

  /**
   * Returns the object type as a string (for JSON serialization)
   * @returns {string}
   */
  toJSON() {
    return this.toString();
  }

  /**
   * Checks equality with another GitObjectType using fast integer comparison
   * @param {GitObjectType} other
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof GitObjectType)) {return false;}
    return this._value === other._value;
  }

  /**
   * Factory method for blob type
   * @returns {GitObjectType}
   */
  static blob() {
    return new GitObjectType(GitObjectType.BLOB_INT);
  }

  /**
   * Factory method for tree type
   * @returns {GitObjectType}
   */
  static tree() {
    return new GitObjectType(GitObjectType.TREE_INT);
  }

  /**
   * Factory method for commit type
   * @returns {GitObjectType}
   */
  static commit() {
    return new GitObjectType(GitObjectType.COMMIT_INT);
  }

  /**
   * Factory method for tag type
   * @returns {GitObjectType}
   */
  static tag() {
    return new GitObjectType(GitObjectType.TAG_INT);
  }

  /**
   * Factory method for ofs-delta type
   * @returns {GitObjectType}
   */
  static ofsDelta() {
    return new GitObjectType(GitObjectType.OFS_DELTA_INT);
  }

  /**
   * Factory method for ref-delta type
   * @returns {GitObjectType}
   */
  static refDelta() {
    return new GitObjectType(GitObjectType.REF_DELTA_INT);
  }

  /**
   * Checks if this is a blob type
   * @returns {boolean}
   */
  isBlob() {
    return this._value === GitObjectType.BLOB_INT;
  }

  /**
   * Checks if this is a tree type
   * @returns {boolean}
   */
  isTree() {
    return this._value === GitObjectType.TREE_INT;
  }

  /**
   * Checks if this is a commit type
   * @returns {boolean}
   */
  isCommit() {
    return this._value === GitObjectType.COMMIT_INT;
  }

  /**
   * Checks if this is a tag type
   * @returns {boolean}
   */
  isTag() {
    return this._value === GitObjectType.TAG_INT;
  }
}
