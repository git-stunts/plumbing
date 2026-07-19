/**
 * @fileoverview Optional duplex command-session port definition
 */

/**
 * @typedef {import('./SessionRunnerOptionsSchema.js').SessionRunnerOptions} SessionRunnerOptions
 * @typedef {import('./SessionRunnerResultSchema.js').SessionRunnerResult} SessionRunnerResult
 */

/**
 * @callback CommandSessionRunner
 * @param {SessionRunnerOptions} options
 * @returns {Promise<SessionRunnerResult>}
 */
