import { z } from 'zod';
import { GitShaSchema } from './GitShaSchema.js';
import { GitSignatureSchema } from './GitSignatureSchema.js';

/**
 * Zod schema for GitCommit validation.
 */
export const GitCommitSchema = z.object({
  sha: GitShaSchema.nullable().optional(),
  treeSha: GitShaSchema, // Reference to the tree
  parents: z.array(GitShaSchema),
  author: GitSignatureSchema,
  committer: GitSignatureSchema,
  message: z.string()
});
