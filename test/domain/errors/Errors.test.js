
import GitPlumbingError from '../../../src/domain/errors/GitPlumbingError.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';
import InvalidArgumentError from '../../../src/domain/errors/InvalidArgumentError.js';
import InvalidGitObjectTypeError from '../../../src/domain/errors/InvalidGitObjectTypeError.js';

describe('Custom Errors', () => {
  it('GitPlumbingError has correct properties', () => {
    const error = new GitPlumbingError('message', 'op', { foo: 'bar' });
    expect(error.message).toBe('message');
    expect(error.operation).toBe('op');
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('GitPlumbingError');
    expect(error).toBeInstanceOf(Error);
  });

  it('ValidationError inherits from GitPlumbingError', () => {
    const error = new ValidationError('invalid', 'op');
    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error.name).toBe('ValidationError');
  });

  it('InvalidArgumentError inherits from GitPlumbingError', () => {
    const error = new InvalidArgumentError('bad arg', 'op');
    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error.name).toBe('InvalidArgumentError');
  });

  it('InvalidGitObjectTypeError has specific message', () => {
    const error = new InvalidGitObjectTypeError('blobby', 'op');
    expect(error.message).toBe('Invalid Git object type: blobby');
    expect(error.details.type).toBe('blobby');
  });
});
