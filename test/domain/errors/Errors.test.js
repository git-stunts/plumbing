
import GitPlumbingError from '../../../src/domain/errors/GitPlumbingError.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';
import InvalidArgumentError from '../../../src/domain/errors/InvalidArgumentError.js';
import InvalidGitObjectTypeError from '../../../src/domain/errors/InvalidGitObjectTypeError.js';
import GitObjectMissingError from '../../../src/domain/errors/GitObjectMissingError.js';
import GitProtocolError from '../../../src/domain/errors/GitProtocolError.js';
import UnsupportedCapabilityError from '../../../src/domain/errors/UnsupportedCapabilityError.js';

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

  it('GitProtocolError identifies protocol failures', () => {
    const error = new GitProtocolError('bad frame', 'op', {
      code: 'CALLER_OVERRIDE',
      frame: 'bad'
    });
    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error.name).toBe('GitProtocolError');
    expect(error.details).toEqual({ code: 'GIT_PROTOCOL_ERROR', frame: 'bad' });
  });

  it('GitObjectMissingError identifies an expected missing object', () => {
    const error = new GitObjectMissingError('deadbeef', 'op', {
      code: 'CALLER_OVERRIDE',
      objectName: 'caller override'
    });
    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error.name).toBe('GitObjectMissingError');
    expect(error.details).toMatchObject({
      code: 'GIT_OBJECT_MISSING',
      objectName: 'deadbeef'
    });
  });

  it('UnsupportedCapabilityError names the unavailable capability', () => {
    const error = new UnsupportedCapabilityError('duplex sessions', 'op', {
      capability: 'caller override',
      code: 'CALLER_OVERRIDE'
    });
    expect(error).toBeInstanceOf(GitPlumbingError);
    expect(error.name).toBe('UnsupportedCapabilityError');
    expect(error.details).toMatchObject({
      capability: 'duplex sessions',
      code: 'UNSUPPORTED_CAPABILITY'
    });
  });
});
