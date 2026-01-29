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

  describe('Per-command flag allowlists', () => {
    describe('show command', () => {
      it('allows whitelisted flags for show', () => {
        expect(() => sanitizer.sanitize(['show', '--format=%B', '-s', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['show', '--pretty=oneline', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['show', '--no-patch', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['show', '--quiet', 'HEAD'])).not.toThrow();
      });

      it('rejects non-whitelisted flags for show', () => {
        expect(() => sanitizer.sanitize(['show', '--diff-filter=A', 'HEAD'])).toThrow(ProhibitedFlagError);
        expect(() => sanitizer.sanitize(['show', '--follow', 'HEAD'])).toThrow(ProhibitedFlagError);
        expect(() => sanitizer.sanitize(['show', '-p', 'HEAD'])).toThrow(ProhibitedFlagError);
      });

      it('allows show with no ref (defaults to HEAD)', () => {
        expect(() => sanitizer.sanitize(['show'])).not.toThrow();
        expect(() => sanitizer.sanitize(['show', '--format=%B'])).not.toThrow();
      });
    });

    describe('log command', () => {
      it('allows whitelisted flags for log', () => {
        expect(() => sanitizer.sanitize(['log', '--format=%H', '-z', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['log', '-n', '10', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['log', '--max-count=50', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['log', '--oneline', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['log', '--first-parent', 'HEAD'])).not.toThrow();
      });

      it('rejects non-whitelisted flags for log', () => {
        expect(() => sanitizer.sanitize(['log', '--diff-filter=M', 'HEAD'])).toThrow(ProhibitedFlagError);
        expect(() => sanitizer.sanitize(['log', '--follow', 'HEAD'])).toThrow(ProhibitedFlagError);
        expect(() => sanitizer.sanitize(['log', '-p', 'HEAD'])).toThrow(ProhibitedFlagError);
      });

      it('allows log with no arguments', () => {
        expect(() => sanitizer.sanitize(['log'])).not.toThrow();
      });

      it('allows combined numeric short forms (-n10, -15)', () => {
        // -n10 is equivalent to -n 10
        expect(() => sanitizer.sanitize(['log', '-n10', 'HEAD'])).not.toThrow();
        // -15 is equivalent to -n 15 (git shorthand)
        expect(() => sanitizer.sanitize(['log', '-15', 'HEAD'])).not.toThrow();
        // Combined with other flags
        expect(() => sanitizer.sanitize(['log', '-n5', '--format=%H', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['log', '-3', '--oneline'])).not.toThrow();
      });
    });

    describe('other commands have no additional restrictions', () => {
      it('allows any flags for rev-parse', () => {
        expect(() => sanitizer.sanitize(['rev-parse', '--show-toplevel'])).not.toThrow();
        expect(() => sanitizer.sanitize(['rev-parse', '--abbrev-ref', 'HEAD'])).not.toThrow();
      });

      it('allows any flags for cat-file', () => {
        expect(() => sanitizer.sanitize(['cat-file', '-p', 'HEAD'])).not.toThrow();
        expect(() => sanitizer.sanitize(['cat-file', '-t', 'HEAD'])).not.toThrow();
      });
    });
  });

  describe('Argument injection protection (spawn safety)', () => {
    it('safely handles shell metacharacters in flag values', () => {
      // spawn() passes args directly - no shell parsing
      expect(() => sanitizer.sanitize(['log', '--format=%; rm -rf /', 'HEAD'])).not.toThrow();
      expect(() => sanitizer.sanitize(['log', '--author=foo; cat /etc/passwd', 'HEAD'])).not.toThrow();
    });

    it('safely handles backticks in arguments', () => {
      expect(() => sanitizer.sanitize(['log', '--format=`whoami`', 'HEAD'])).not.toThrow();
    });

    it('safely handles $() command substitution in arguments', () => {
      expect(() => sanitizer.sanitize(['log', '--format=$(id)', 'HEAD'])).not.toThrow();
    });

    it('safely handles pipe characters in arguments', () => {
      expect(() => sanitizer.sanitize(['log', '--format=%s | malicious', 'HEAD'])).not.toThrow();
    });

    it('safely handles newlines in arguments', () => {
      expect(() => sanitizer.sanitize(['log', '--format=%s\n%b', 'HEAD'])).not.toThrow();
    });

    it('safely handles quotes in arguments', () => {
      expect(() => sanitizer.sanitize(['log', '--author="John Doe"', 'HEAD'])).not.toThrow();
      expect(() => sanitizer.sanitize(['log', "--author='Jane Doe'", 'HEAD'])).not.toThrow();
    });
  });

  describe('NUL-terminated output (log -z)', () => {
    it('allows log with -z flag', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--format=%H', 'HEAD'])).not.toThrow();
    });

    it('allows log with -z and multiple format specifiers', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--format=%H%x00%s%x00%b'])).not.toThrow();
    });

    it('allows log with -z combined with -n', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '-n', '10', 'HEAD'])).not.toThrow();
    });

    it('allows log with -z and --max-count', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--max-count=50', 'main..HEAD'])).not.toThrow();
    });

    it('allows log with -z and ancestry path traversal', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--ancestry-path', '--format=%H', 'main..HEAD'])).not.toThrow();
    });

    it('allows log with -z and first-parent for linear history', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--first-parent', '--format=%H%x00%P', 'HEAD'])).not.toThrow();
    });

    it('allows log with -z and reverse for chronological order', () => {
      expect(() => sanitizer.sanitize(['log', '-z', '--reverse', '--format=%H', 'HEAD~10..HEAD'])).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('throws for empty array', () => {
      expect(() => sanitizer.sanitize([])).toThrow(ValidationError);
    });

    it('allows commands with only the command name (no flags or refs)', () => {
      expect(() => sanitizer.sanitize(['show'])).not.toThrow();
      expect(() => sanitizer.sanitize(['log'])).not.toThrow();
      expect(() => sanitizer.sanitize(['rev-parse'])).not.toThrow();
    });

    it('handles flags with = values correctly', () => {
      expect(() => sanitizer.sanitize(['log', '--format=%H'])).not.toThrow();
      expect(() => sanitizer.sanitize(['log', '--max-count=10'])).not.toThrow();
    });

    it('stops flag validation at end-of-options marker (--)', () => {
      // Args after '--' are pathspecs/refs, not flags - should not be validated
      expect(() => sanitizer.sanitize(['show', '--format=%B', '--', '-weird-ref-name'])).not.toThrow();
      expect(() => sanitizer.sanitize(['log', '--oneline', '--', '--not-a-flag'])).not.toThrow();
      // Disallowed flag BEFORE '--' should still throw
      expect(() => sanitizer.sanitize(['show', '-p', '--', 'file.txt'])).toThrow(ProhibitedFlagError);
    });
  });
});