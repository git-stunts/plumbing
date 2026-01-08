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
    [GitObjectType.OFS_DELTA]: GitObjectType.OFS_DELTA_INT,
    [GitObjectType.REF_DELTA]: GitObjectType.REF_DELTA_INT
  };

  /**
   * @param {number} typeInt - The integer representation of the Git object type.
   */
  constructor(typeInt) {
    if (GitObjectType.TYPE_MAP[typeInt] === undefined) {
      throw new InvalidGitObjectTypeError(typeInt);
    }
    this._value = typeInt;
  }

  /**
   * Creates a GitObjectType from a string name.
   * @param {string} typeName - The string name (e.g., 'blob', 'tree').
   * @returns {GitObjectType}
   */
  static fromString(typeName) {
    const typeInt = GitObjectType.STRING_TO_INT[typeName];
    if (typeInt === undefined) {
      throw new InvalidGitObjectTypeError(typeName);
    }
    return new GitObjectType(typeInt);
  }

  /**
   * Returns if the type is valid
   * @param {number} typeInt
   * @returns {boolean}
   */
  static isValid(typeInt) {
    return GitObjectType.TYPE_MAP[typeInt] !== undefined;
  }

  /**
   * Returns the integer representation
   * @returns {number}
   */
  toNumber() {
    return this._value;
  }

  /**
   * Returns the string representation
   * @returns {string}
   */
  toString() {
    return GitObjectType.TYPE_MAP[this._value];
  }

  /**
   * Returns the string representation (for JSON serialization)
   * @returns {string}
   */
  toJSON() {
    return this.toString();
  }

  /**
   * Checks equality with another GitObjectType
   * @param {GitObjectType} other
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof GitObjectType)) {return false;}
    return this._value === other._value;
  }

  /**
   * Returns if this is a blob
   * @returns {boolean}
   */
  isBlob() {
    return this._value === GitObjectType.BLOB_INT;
  }

  /**
   * Returns if this is a tree
   * @returns {boolean}
   */
  isTree() {
    return this._value === GitObjectType.TREE_INT;
  }

  /**
   * Returns if this is a commit
   * @returns {boolean}
   */
  isCommit() {
    return this._value === GitObjectType.COMMIT_INT;
  }

  /**
   * Returns if this is a tag
   * @returns {boolean}
   */
  isTag() {
    return this._value === GitObjectType.TAG_INT;
  }

  /**
   * Static factory methods
   */
  static blob() { return new GitObjectType(GitObjectType.BLOB_INT); }
  static tree() { return new GitObjectType(GitObjectType.TREE_INT); }
  static commit() { return new GitObjectType(GitObjectType.COMMIT_INT); }
  static tag() { return new GitObjectType(GitObjectType.TAG_INT); }
}