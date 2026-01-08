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
  .refine(val => {
    // Prohibited characters: space, ~, ^, :, ?, *, [, \
    const prohibited = [' ', '~', '^', ':', '?', '*', '[', '\\'];
    return !prohibited.some(char => val.includes(char));
  }, 'Contains prohibited characters')
  .refine(val => {
    // Control characters (0-31 and 127)
    return !Array.from(val).some(char => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    });
  }, 'Cannot contain control characters')
  .refine(val => val !== '@' && !val.includes('@{'), "Cannot be '@' alone or contain '@{'");