/**
 * @fileoverview GitRef value object - immutable Git reference with validation
 */

import ValidationError from '../errors/ValidationError.js';

/**
 * GitRef represents a Git reference with validation.
 * References must be valid Git ref names.
 */
export default class GitRef {
  static PREFIX_HEADS = 'refs/heads/';
  static PREFIX_TAGS = 'refs/tags/';
  static PREFIX_REMOTES = 'refs/remotes/';
  
  // Prohibited characters according to git-check-ref-format
  static PROHIBITED_CHARS = [' ', '~', '^', ':', '?', '*', '[', '\\'];

  /**
   * @param {string} ref - The Git reference string
   */
  constructor(ref) {
    if (!GitRef.isValid(ref)) {
      throw new ValidationError(`Invalid Git reference: ${ref}`, 'GitRef.constructor', { ref });
    }
    this._value = ref;
  }

  /**
   * Validates if a string is a valid Git reference
   * @param {string} ref
   * @returns {boolean}
   */
  static isValid(ref) {
    if (typeof ref !== 'string') {return false;}
    
    return (
      this._hasValidStructure(ref) &&
      this._hasNoProhibitedChars(ref) &&
      this._isNotReserved(ref)
    );
  }

  /**
   * Checks if the reference has a valid structure (no double dots, starts/ends with dot, etc.)
   * @private
   */
  static _hasValidStructure(ref) {
    if (ref.startsWith('.') || ref.endsWith('.')) {return false;}
    if (ref.includes('..')) {return false;}
    if (ref.includes('/.')) {return false;}
    if (ref.includes('//')) {return false;}
    if (ref.endsWith('.lock')) {return false;}
    return true;
  }

  /**
   * Checks for prohibited characters and control characters
   * @private
   */
  static _hasNoProhibitedChars(ref) {
    for (const char of ref) {
      // Control characters (0-31 and 127)
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) {return false;}
      
      if (this.PROHIBITED_CHARS.includes(char)) {return false;}
    }
    return true;
  }

  /**
   * Checks if the reference is reserved or contains reserved patterns
   * @private
   */
  static _isNotReserved(ref) {
    if (ref.includes('@')) {return false;}
    return true;
  }

  /**
   * Creates a GitRef from a string, throwing if invalid
   * @param {string} ref
   * @returns {GitRef}
   */
  static fromString(ref) {
    return new GitRef(ref);
  }

  /**
   * Creates a GitRef from a string, returning null if invalid
   * @param {string} ref
   * @returns {GitRef|null}
   */
  static fromStringOrNull(ref) {
    try {
      if (!GitRef.isValid(ref)) {return null;}
      return new GitRef(ref);
    } catch {
      return null;
    }
  }

  /**
   * Returns the Git reference as a string
   * @returns {string}
   */
  toString() {
    return this._value;
  }

  /**
   * Returns the Git reference as a string (for JSON serialization)
   * @returns {string}
   */
  toJSON() {
    return this._value;
  }

  /**
   * Checks equality with another GitRef
   * @param {GitRef} other
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof GitRef)) {return false;}
    return this._value === other._value;
  }

  /**
   * Checks if this is a branch reference
   * @returns {boolean}
   */
  isBranch() {
    return this._value.startsWith(GitRef.PREFIX_HEADS);
  }

  /**
   * Checks if this is a tag reference
   * @returns {boolean}
   */
  isTag() {
    return this._value.startsWith(GitRef.PREFIX_TAGS);
  }

  /**
   * Checks if this is a remote reference
   * @returns {boolean}
   */
  isRemote() {
    return this._value.startsWith(GitRef.PREFIX_REMOTES);
  }

  /**
   * Gets the short name of the reference (without refs/heads/ prefix)
   * @returns {string}
   */
  shortName() {
    if (this.isBranch()) {
      return this._value.substring(GitRef.PREFIX_HEADS.length);
    }
    if (this.isTag()) {
      return this._value.substring(GitRef.PREFIX_TAGS.length);
    }
    if (this.isRemote()) {
      return this._value.substring(GitRef.PREFIX_REMOTES.length);
    }
    return this._value;
  }

  /**
   * Creates a branch reference
   * @param {string} name
   * @returns {GitRef}
   */
  static branch(name) {
    return new GitRef(`${GitRef.PREFIX_HEADS}${name}`);
  }

  /**
   * Creates a tag reference
   * @param {string} name
   * @returns {GitRef}
   */
  static tag(name) {
    return new GitRef(`${GitRef.PREFIX_TAGS}${name}`);
  }

  /**
   * Creates a remote reference
   * @param {string} remote
   * @param {string} name
   * @returns {GitRef}
   */
  static remote(remote, name) {
    return new GitRef(`${GitRef.PREFIX_REMOTES}${remote}/${name}`);
  }
}