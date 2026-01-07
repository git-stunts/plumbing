/**
 * @fileoverview GitSha value object - immutable SHA-1 hash with validation
 */

import ValidationError from '../errors/ValidationError.js';
import { GitShaSchema } from '../schemas/GitShaSchema.js';

/**
 * GitSha represents a Git SHA-1 hash with validation.
 * SHA-1 hashes are always 40 characters long and contain only hexadecimal characters.
 */
export default class GitSha {
  static LENGTH = 40;
  static SHORT_LENGTH = 7;
  static EMPTY_TREE_VALUE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

  /**
   * @param {string} sha - The SHA-1 hash string
   */
  constructor(sha) {
    this._value = sha;
  }

  /**
   * Creates a GitSha from a string, throwing if invalid.
   * Consolidates validation into a single entry point.
   * @param {string} sha
   * @returns {GitSha}
   * @throws {ValidationError}
   */
  static from(sha) {
    const result = GitShaSchema.safeParse(sha);
    if (!result.success) {
      throw new ValidationError(
        `Invalid SHA-1 hash: "${sha}". Must be a 40-character hexadecimal string.`,
        'GitSha.from',
        { 
          sha,
          helpUrl: 'https://git-scm.com/book/en/v2/Git-Internals-Git-Objects'
        }
      );
    }
    return new GitSha(result.data);
  }

  /**
   * Returns the SHA-1 hash as a string
   * @returns {string}
   */
  toString() {
    return this._value;
  }

  /**
   * Returns the SHA-1 hash as a string (for JSON serialization)
   * @returns {string}
   */
  toJSON() {
    return this._value;
  }

  /**
   * Checks equality with another GitSha
   * @param {GitSha} other
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof GitSha)) {return false;}
    return this._value === other._value;
  }

  /**
   * Returns the short form (first 7 characters) of the SHA
   * @returns {string}
   */
  toShort() {
    return this._value.substring(0, GitSha.SHORT_LENGTH);
  }

  /**
   * Returns if this is the empty tree SHA
   * @returns {boolean}
   */
  isEmptyTree() {
    return this._value === GitSha.EMPTY_TREE_VALUE;
  }

  /**
   * Empty tree SHA constant
   * @returns {GitSha}
   */
  static get EMPTY_TREE() {
    return new GitSha(GitSha.EMPTY_TREE_VALUE);
  }
}
