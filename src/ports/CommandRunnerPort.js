/**
 * @fileoverview CommandRunner port definition
 */

import { DEFAULT_COMMAND_TIMEOUT, DEFAULT_MAX_BUFFER_SIZE, DEFAULT_MAX_STDERR_SIZE } from './RunnerOptionsSchema.js';

export { DEFAULT_COMMAND_TIMEOUT, DEFAULT_MAX_BUFFER_SIZE, DEFAULT_MAX_STDERR_SIZE };

/**
 * @typedef {import('./RunnerOptionsSchema.js').RunnerOptions} RunnerOptions
 * @typedef {import('./RunnerResultSchema.js').RunnerResult} RunnerResult
 */

/**
 * @callback CommandRunner
 * @param {RunnerOptions} options
 * @returns {Promise<RunnerResult>}
 */
