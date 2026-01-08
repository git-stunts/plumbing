/**
 * @fileoverview ExecutionOrchestrator - Domain service for command execution lifecycle
 */

import GitErrorClassifier from './GitErrorClassifier.js';
import GitPlumbingError from '../errors/GitPlumbingError.js';

/**
 * ExecutionOrchestrator manages the retry and failure detection logic for Git commands.
 * Implements a "Total Operation Timeout" to prevent infinite retry loops.
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
    const operationStartTime = performance.now();
    let attempt = 0;

    while (attempt < retryPolicy.maxAttempts) {
      const startTime = performance.now();
      attempt++;

      // 1. Check for total operation timeout before starting attempt
      this._checkTotalTimeout(operationStartTime, retryPolicy.totalTimeout, args, traceId);

      try {
        const { stdout, result } = await execute();
        const latency = performance.now() - startTime;

        // 2. Check for total operation timeout after execute() completes
        // This is important because execute() itself might have taken a long time.
        this._checkTotalTimeout(operationStartTime, retryPolicy.totalTimeout, args, traceId);

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
            
            // Re-check if we have time for backoff + next attempt
            if (retryPolicy.totalTimeout && (performance.now() - operationStartTime + backoff) > retryPolicy.totalTimeout) {
              throw error; // Not enough time left for backoff
            }

            await new Promise(resolve => setTimeout(resolve, backoff));
            continue;
          }

          throw error;
        }

        return stdout.trim();
      } catch (err) {
        // Wrap unexpected errors or rethrow classified ones
        if (err instanceof GitPlumbingError) {
          throw err;
        }
        throw new GitPlumbingError(err.message, 'ExecutionOrchestrator.orchestrate', { 
          args, 
          traceId, 
          originalError: err 
        });
      }
    }
  }

  /**
   * Helper to verify if total operation timeout has been exceeded.
   * @private
   */
  _checkTotalTimeout(startTime, totalTimeout, args, traceId) {
    if (!totalTimeout) {return;}
    
    const elapsedTotal = performance.now() - startTime;
    if (elapsedTotal > totalTimeout) {
      throw new GitPlumbingError(
        `Total operation timeout exceeded after ${Math.round(elapsedTotal)}ms`, 
        'ExecutionOrchestrator.orchestrate',
        { args, traceId, elapsedTotal, totalTimeout }
      );
    }
  }
}