import { z } from 'zod';
import { GitShaSchema } from './GitShaSchema.js';
import { GitTreeEntrySchema } from './GitTreeEntrySchema.js';

/**
 * Zod schema for GitTree validation.
 */
export const GitTreeSchema = z.object({
  sha: GitShaSchema.nullable().optional(),
  entries: z.array(GitTreeEntrySchema)
});
