import { z } from 'zod';
import { GitShaSchema } from './GitShaSchema.js';
import { GitFileModeSchema } from './GitFileModeSchema.js';

/**
 * Zod schema for GitTreeEntry validation.
 */
export const GitTreeEntrySchema = z.object({
  mode: GitFileModeSchema,
  sha: GitShaSchema,
  path: z.string().min(1)
});
