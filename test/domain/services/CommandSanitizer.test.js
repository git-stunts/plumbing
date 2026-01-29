import CommandSanitizer from '../../../src/domain/services/CommandSanitizer.js';
import ValidationError from '../../../src/domain/errors/ValidationError.js';
import ProhibitedFlagError from '../../../src/domain/errors/ProhibitedFlagError.js';

describe('CommandSanitizer', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new CommandSanitizer();
  });

  it('allows whitelisted commands', () => {
    expect(() => sanitizer.sanitize(['rev-parse', 'HEAD'])).not.toThrow();
  });

  it('allows log command for commit history traversal', () => {
    expect(() => sanitizer.sanitize(['log', '--format=%H', '-z', 'HEAD'])).not.toThrow();
  });

  it('allows show command for reading commit messages', () => {
    expect(() => sanitizer.sanitize(['show', '--format=%B', '-s', 'HEAD'])).not.toThrow();
  });

  it('throws ValidationError for unlisted commands', () => {
    expect(() => sanitizer.sanitize(['push', 'origin', 'main'])).toThrow(ValidationError);
  });

  it('throws ProhibitedFlagError for banned flags', () => {
    expect(() => sanitizer.sanitize(['rev-parse', '--work-tree=/tmp', 'HEAD'])).toThrow(ProhibitedFlagError);
  });

  it('blocks global flags anywhere in the argument list', () => {
    expect(() => sanitizer.sanitize(['-C', '/tmp', 'rev-parse', 'HEAD'])).toThrow(ProhibitedFlagError);
    expect(() => sanitizer.sanitize(['rev-parse', '-c', 'user.name=attacker', 'HEAD'])).toThrow(ProhibitedFlagError);
    expect(() => sanitizer.sanitize(['--git-dir=/tmp/.git', 'rev-parse', 'HEAD'])).toThrow(ProhibitedFlagError);
  });

  it('allows exactly --version as a special case', () => {
    expect(() => sanitizer.sanitize(['--version'])).not.toThrow();
  });

  it('allows dynamic registration of commands', () => {
    const testCmd = 'test-command-' + Math.random();
    expect(() => sanitizer.sanitize([testCmd])).toThrow(ValidationError);
    CommandSanitizer.allow(testCmd);
    expect(() => sanitizer.sanitize([testCmd])).not.toThrow();
  });

  it('uses memoization to skip re-validation', () => {
    const args = ['rev-parse', 'HEAD'];
    const result = sanitizer.sanitize(args);
    expect(result).toBe(args);
  });

  it('handles cache eviction', () => {
    const smallSanitizer = new CommandSanitizer({ maxCacheSize: 2 });
    
    const args1 = ['rev-parse', 'HEAD'];
    const args2 = ['cat-file', '-p', '4b825dc642cb6eb9a060e54bf8d69288fbee4904'];
    const args3 = ['ls-tree', 'HEAD'];
    
    smallSanitizer.sanitize(args1);
    smallSanitizer.sanitize(args2);
    smallSanitizer.sanitize(args3);
  });
});