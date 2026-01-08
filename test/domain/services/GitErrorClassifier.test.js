import GitErrorClassifier from '../../../src/domain/services/GitErrorClassifier.js';
import GitRepositoryLockedError from '../../../src/domain/errors/GitRepositoryLockedError.js';
import GitPlumbingError from '../../../src/domain/errors/GitPlumbingError.js';

describe('GitErrorClassifier', () => {
  const classifier = new GitErrorClassifier();
  const baseOptions = {
    args: ['rev-parse', 'HEAD'],
    traceId: 'test-trace',
    latency: 100,
    operation: 'test-op'
  };

  it('classifies index.lock as a locked error', () => {
    const error = classifier.classify({
      ...baseOptions,
      code: 128,
      stderr: 'fatal: Unable to create \'/path/to/.git/index.lock\': File exists.'
    });

    expect(error).toBeInstanceOf(GitRepositoryLockedError);
    expect(classifier.isRetryable(error)).toBe(true);
  });

  it('classifies other .lock files as locked errors', () => {
    const error = classifier.classify({
      ...baseOptions,
      code: 128,
      stderr: 'fatal: Unable to create \'/path/to/.git/refs/heads/main.lock\': File exists.'
    });

    expect(error).toBeInstanceOf(GitRepositoryLockedError);
  });

  it('allows injecting custom rules via constructor', () => {
    class CustomError extends Error { constructor(msg) { super(msg); this.name = 'CustomError'; } }
    
    const customClassifier = new GitErrorClassifier({
      customRules: [{
        test: (code, _stderr) => code === 42,
        create: (_opts) => new CustomError('Meaning of life error')
      }]
    });

    const error = customClassifier.classify({
      ...baseOptions,
      code: 42,
      stderr: 'The universe exploded'
    });

    expect(error.name).toBe('CustomError');
    expect(error.message).toBe('Meaning of life error');
  });

  it('classifies generic failures as GitPlumbingError', () => {
    const error = classifier.classify({
      ...baseOptions,
      code: 1,
      stderr: "error: unknown option `foo'"
    });

    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error).not.toBeInstanceOf(GitRepositoryLockedError);
    expect(classifier.isRetryable(error)).toBe(false);
  });

  it('classifies code 128 without lock message as GitPlumbingError', () => {
    const error = classifier.classify({
      ...baseOptions,
      code: 128,
      stderr: 'fatal: not a git repository'
    });

    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error).not.toBeInstanceOf(GitRepositoryLockedError);
  });
});
