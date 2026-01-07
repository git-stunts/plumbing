/**
 * @fileoverview ExecutionOrchestrator - Domain service for command execution lifecycle
 */

import GitPlumbingError from '../errors/GitPlumbingError.js';
import GitRepositoryLockedError from '../errors/GitRepositoryLockedError.js';

/**
 * ExecutionOrchestrator manages the retry and failure detection logic for Git commands.
 */
export default class ExecutionOrchestrator {
  /**
   * Orchestrates the execution of a command with retry and lock detection.
   * @param {Object} options
   * @param {Function} options.execute - Async function that performs a single execution attempt.
   * @param {import('../value-objects/CommandRetryPolicy.js').default} options.retryPolicy
   * @param {string[]} options.args
   * @param {string} options.traceId
   * @returns {Promise<string>}
   */
  static async orchestrate({ execute, retryPolicy, args, traceId }) {
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      const startTime = performance.now();
      attempt++;

      try {
        const { stdout, result } = await execute();
        const latency = performance.now() - startTime;

        if (result.code !== 0) {
          // Check for lock contention
          const isLocked = result.stderr.includes('index.lock') || result.stderr.includes('.lock');
          if (isLocked) {
            if (attempt < retryPolicy.maxAttempts) {
              const backoff = retryPolicy.getDelay(attempt + 1);
              await new Promise(resolve => setTimeout(resolve, backoff));
              continue;
            }
            throw new GitRepositoryLockedError(`Git command failed: repository is locked`, 'ExecutionOrchestrator.orchestrate', {
              args,
              stderr: result.stderr,
              code: result.code,
              traceId,
              latency
            });
          }

          throw new GitPlumbingError(`Git command failed with code ${result.code}`, 'ExecutionOrchestrator.orchestrate', {
            args,
            stderr: result.stderr,
            stdout,
            code: result.code,
            traceId,
            latency,
            timedOut: result.timedOut
          });
        }

        return stdout.trim();
      } catch (err) {
        if (err instanceof GitPlumbingError) {
          throw err;
        }
        throw new GitPlumbingError(err.message, 'ExecutionOrchestrator.orchestrate', { 
          args, 
          originalError: err, 
          traceId,
          latency: performance.now() - startTime
        });
      }
    }
  }
}
