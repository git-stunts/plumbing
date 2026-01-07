import { z } from 'zod';

/**
 * Zod schema for GitSha validation.
 */
export const GitShaSchema = z.string()
  .length(40)
  .regex(/^[a-f0-9]+$/i)
  .transform(val => val.toLowerCase());

/**
 * Zod schema for GitSha object structure.
 */
export const GitShaObjectSchema = z.object({
  sha: GitShaSchema
});
