/**
 * @fileoverview ExecutionOrchestrator - Domain service for command execution lifecycle
 */

import GitErrorClassifier from './GitErrorClassifier.js';

/**
 * ExecutionOrchestrator manages the retry and failure detection logic for Git commands.
 */
export default class ExecutionOrchestrator {
  /**
   * @param {Object} [options]
   * @param {GitErrorClassifier} [options.classifier]
   */
  constructor({ classifier = new GitErrorClassifier() } = {}) {
    /** @private */
    this.classifier = classifier;
  }

  /**
   * Orchestrates the execution of a command with retry and lock detection.
   * @param {Object} options
   * @param {Function} options.execute - Async function that performs a single execution attempt.
   * @param {import('../value-objects/CommandRetryPolicy.js').default} options.retryPolicy
   * @param {string[]} options.args
   * @param {string} options.traceId
   * @returns {Promise<string>}
   */
  async orchestrate({ execute, retryPolicy, args, traceId }) {
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      const startTime = performance.now();
      attempt++;

      try {
        const { stdout, result } = await execute();
        const latency = performance.now() - startTime;

        if (result.code !== 0) {
          const error = this.classifier.classify({
            code: result.code,
            stderr: result.stderr,
            args,
            stdout,
            traceId,
            latency,
            operation: 'ExecutionOrchestrator.orchestrate'
          });

          if (this.classifier.isRetryable(error) && attempt < retryPolicy.maxAttempts) {
            const backoff = retryPolicy.getDelay(attempt + 1);
            await new Promise(resolve => setTimeout(resolve, backoff));
            continue;
          }

          throw error;
        }

        return stdout.trim();
      } catch (err) {
        // If it's already a classified error, just rethrow
        if (err.name?.includes('Error')) {
           // We already classified it if result.code was non-zero
           // If it's a timeout or spawn error, we might need classification
        }
        
        // Re-classify unexpected errors if needed, but usually we just want to wrap them
        throw err;
      }
    }
  }
}