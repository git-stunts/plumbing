import { z } from 'zod';

/**
 * Zod schema for GitRef validation.
 * Implements core rules of git-check-ref-format.
 */
export const GitRefSchema = z.string()
  .min(1)
  .refine(val => !val.startsWith('.'), 'Cannot start with a dot')
  .refine(val => !val.endsWith('.'), 'Cannot end with a dot')
  .refine(val => !val.includes('..'), 'Cannot contain double dots')
  .refine(val => !val.includes('/.'), 'Components cannot start with a dot')
  .refine(val => !val.includes('//'), 'Cannot contain consecutive slashes')
  .refine(val => !val.endsWith('.lock'), 'Cannot end with .lock')
  .refine(val => !/[ ~^:?*[\\]/.test(val), 'Contains prohibited characters')
  .refine(val => !val.includes('@'), "Cannot contain '@'")
  .refine(val => {
    // Control characters (0-31 and 127)
    for (let i = 0; i < val.length; i++) {
      const code = val.charCodeAt(i);
      if (code < 32 || code === 127) {
        return false;
      }
    }
    return true;
  }, 'Cannot contain control characters');

