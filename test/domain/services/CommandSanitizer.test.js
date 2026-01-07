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

  it('throws ValidationError for unlisted commands', () => {
    expect(() => sanitizer.sanitize(['push', 'origin', 'main'])).toThrow(ValidationError);
  });

  it('throws ProhibitedFlagError for banned flags', () => {
    expect(() => sanitizer.sanitize(['rev-parse', '--work-tree=/tmp', 'HEAD'])).toThrow(ProhibitedFlagError);
    try {
      sanitizer.sanitize(['rev-parse', '--work-tree=/tmp', 'HEAD']);
    } catch (err) {
      expect(err.message).toContain('Prohibited git flag detected');
      expect(err.message).toContain('--work-tree');
      expect(err.message).toContain('README.md');
    }
  });

  it('allows dynamic registration of commands', () => {
    expect(() => sanitizer.sanitize(['status'])).toThrow(ValidationError);
    CommandSanitizer.allow('status');
    expect(() => sanitizer.sanitize(['status'])).not.toThrow();
  });

  it('uses memoization to skip re-validation', () => {
    const args = ['rev-parse', 'HEAD'];
    
    // First time
    sanitizer.sanitize(args);
    
    // Modify ALLOWED_COMMANDS to prove we use cache
    const originalAllowed = CommandSanitizer._ALLOWED_COMMANDS;
    CommandSanitizer._ALLOWED_COMMANDS = new Set();
    
    // Should still work because of cache
    expect(() => sanitizer.sanitize(args)).not.toThrow();
    
    // Restore
    CommandSanitizer._ALLOWED_COMMANDS = originalAllowed;
  });

  it('handles cache eviction', () => {
    const smallSanitizer = new CommandSanitizer({ maxCacheSize: 2 });
    
    smallSanitizer.sanitize(['rev-parse', 'HEAD']);
    smallSanitizer.sanitize(['cat-file', '-p', 'SHA']);
    
    // This should evict rev-parse
    smallSanitizer.sanitize(['ls-tree', 'HEAD']);
    
    const originalAllowed = CommandSanitizer._ALLOWED_COMMANDS;
    CommandSanitizer._ALLOWED_COMMANDS = new Set();
    
    // rev-parse should now throw because it's not in cache and not in allowed commands
    expect(() => smallSanitizer.sanitize(['rev-parse', 'HEAD'])).toThrow(ValidationError);
    
    CommandSanitizer._ALLOWED_COMMANDS = originalAllowed;
  });
});
