import ExecutionOrchestrator from '../../../src/domain/services/ExecutionOrchestrator.js';
import CommandRetryPolicy from '../../../src/domain/value-objects/CommandRetryPolicy.js';
import GitPlumbingError from '../../../src/domain/errors/GitPlumbingError.js';
import GitErrorClassifier from '../../../src/domain/services/GitErrorClassifier.js';
import GitRepositoryLockedError from '../../../src/domain/errors/GitRepositoryLockedError.js';

describe('ExecutionOrchestrator', () => {
  it('respects totalTimeout even if retries are remaining', async () => {
    const orchestrator = new ExecutionOrchestrator();
    const policy = new CommandRetryPolicy({
      maxAttempts: 10,
      initialDelayMs: 100,
      totalTimeout: 200 // Very short timeout
    });

    const execute = async () => {
      // Simulate work taking longer than timeout
      await new Promise(resolve => setTimeout(resolve, 300));
      return { stdout: 'done', result: { code: 0, stderr: '' } };
    };

    await expect(orchestrator.orchestrate({
      execute,
      retryPolicy: policy,
      args: ['test'],
      traceId: 'trace'
    })).rejects.toThrow(GitPlumbingError);
  });

  it('aborts retries if backoff would exceed totalTimeout', async () => {
    // Mock classifier to always return a retryable error
    const classifier = new GitErrorClassifier();
    const orchestrator = new ExecutionOrchestrator({ classifier });
    
    const policy = new CommandRetryPolicy({
      maxAttempts: 3,
      initialDelayMs: 500, // Delay for 2nd retry
      totalTimeout: 600    // Short total timeout
    });

    let attempts = 0;
    const execute = async () => {
      attempts++;
      return { 
        stdout: '', 
        result: { code: 128, stderr: 'index.lock' } 
      };
    };

    let error;
    try {
      await orchestrator.orchestrate({
        execute,
        retryPolicy: policy,
        args: ['test'],
        traceId: 'trace'
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(GitRepositoryLockedError);
    // With getDelay(attempt):
    // Attempt 1 fails. backoff = getDelay(1) = 0. 0 < 600. Proceeds to Attempt 2.
    // Attempt 2 fails. backoff = getDelay(2) = 500. elapsed + 500 > 600. Aborts.
    expect(attempts).toBe(2);
  });
});