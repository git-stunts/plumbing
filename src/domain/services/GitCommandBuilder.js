/**
 * @fileoverview Domain service for building git command arguments
 */

/**
 * Fluent builder for git command arguments.
 * Provides a type-safe and expressive API for constructing Git plumbing commands.
 */
export default class GitCommandBuilder {
  /**
   * @param {string} command - The git plumbing command (e.g., 'update-ref')
   */
  constructor(command) {
    this._command = command;
    this._args = [command];
  }

  // --- Static Factory Methods ---

  static revParse() { return new GitCommandBuilder('rev-parse'); }
  static updateRef() { return new GitCommandBuilder('update-ref'); }
  static catFile() { return new GitCommandBuilder('cat-file'); }
  static hashObject() { return new GitCommandBuilder('hash-object'); }
  static lsTree() { return new GitCommandBuilder('ls-tree'); }
  static commitTree() { return new GitCommandBuilder('commit-tree'); }
  static writeTree() { return new GitCommandBuilder('write-tree'); }
  static readTree() { return new GitCommandBuilder('read-tree'); }
  static revList() { return new GitCommandBuilder('rev-list'); }
  static mktree() { return new GitCommandBuilder('mktree'); }
  static unpackObjects() { return new GitCommandBuilder('unpack-objects'); }
  static symbolicRef() { return new GitCommandBuilder('symbolic-ref'); }
  static forEachRef() { return new GitCommandBuilder('for-each-ref'); }
  static showRef() { return new GitCommandBuilder('show-ref'); }
  static diffTree() { return new GitCommandBuilder('diff-tree'); }
  static diffIndex() { return new GitCommandBuilder('diff-index'); }
  static diffFiles() { return new GitCommandBuilder('diff-files'); }
  static mergeBase() { return new GitCommandBuilder('merge-base'); }
  static lsFiles() { return new GitCommandBuilder('ls-files'); }
  static checkIgnore() { return new GitCommandBuilder('check-ignore'); }
  static checkAttr() { return new GitCommandBuilder('check-attr'); }
  static version() { return new GitCommandBuilder('--version'); }
  static init() { return new GitCommandBuilder('init'); }
  static config() { return new GitCommandBuilder('config'); }

  // --- Fluent flag methods ---

  /**
   * Adds the --stdin flag
   * @returns {GitCommandBuilder}
   */
  stdin() {
    this._args.push('--stdin');
    return this;
  }

  /**
   * Adds the -w flag (write)
   * @returns {GitCommandBuilder}
   */
  write() {
    this._args.push('-w');
    return this;
  }

  /**
   * Adds the -p flag (pretty-print)
   * @returns {GitCommandBuilder}
   */
  pretty() {
    this._args.push('-p');
    return this;
  }

  /**
   * Adds the -t flag (type)
   * @returns {GitCommandBuilder}
   */
  type() {
    this._args.push('-t');
    return this;
  }

  /**
   * Adds the -s flag (size)
   * @returns {GitCommandBuilder}
   */
  size() {
    this._args.push('-s');
    return this;
  }

  /**
   * Adds the -m flag (message)
   * @param {string} msg
   * @returns {GitCommandBuilder}
   */
  message(msg) {
    this._args.push('-m', msg);
    return this;
  }

  /**
   * Adds the -p flag (parent) - Note: shared with pretty-print in some commands
   * @param {string} sha
   * @returns {GitCommandBuilder}
   */
  parent(sha) {
    this._args.push('-p', sha);
    return this;
  }

  /**
   * Adds the -d flag (delete)
   * @returns {GitCommandBuilder}
   */
  delete() {
    this._args.push('-d');
    return this;
  }

  /**
   * Adds the -z flag (NUL-terminated output)
   * @returns {GitCommandBuilder}
   */
  nul() {
    this._args.push('-z');
    return this;
  }

  /**
   * Adds the --batch flag
   * @returns {GitCommandBuilder}
   */
  batch() {
    this._args.push('--batch');
    return this;
  }

  /**
   * Adds the --batch-check flag
   * @returns {GitCommandBuilder}
   */
  batchCheck() {
    this._args.push('--batch-check');
    return this;
  }

  /**
   * Adds the --all flag
   * @returns {GitCommandBuilder}
   */
  all() {
    this._args.push('--all');
    return this;
  }

  /**
   * Adds a positional argument to the command.
   * @param {string|number|null|undefined} arg - The argument to add.
   * @returns {GitCommandBuilder} This builder instance for chaining.
   */
  arg(arg) {
    if (arg !== undefined && arg !== null) {
      this._args.push(String(arg));
    }
    return this;
  }

  /**
   * Builds the arguments array
   * @returns {string[]}
   */
  build() {
    return [...this._args];
  }
}
