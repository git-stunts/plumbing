/**
 * @fileoverview Domain service for building git command arguments
 */

/**
 * Fluent builder for git command arguments
 */
export default class GitCommandBuilder {
  /**
   * @param {string} command - The git plumbing command (e.g., 'update-ref')
   */
  constructor(command) {
    this._command = command;
    this._args = [command];
  }

  /**
   * Starts building an update-ref command
   * @returns {GitCommandBuilder}
   */
  static updateRef() {
    return new GitCommandBuilder('update-ref');
  }

  /**
   * Starts building a rev-parse command
   * @returns {GitCommandBuilder}
   */
  static revParse() {
    return new GitCommandBuilder('rev-parse');
  }

  /**
   * Adds the delete flag
   * @returns {GitCommandBuilder}
   */
  delete() {
    this._args.push('-d');
    return this;
  }

  /**
   * Adds a positional argument
   * @param {string} arg
   * @returns {GitCommandBuilder}
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
