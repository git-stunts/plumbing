import { z } from 'zod';
import { GitShaSchema } from './GitShaSchema.js';

/**
 * Zod schema for GitBlob validation.
 */
export const GitBlobSchema = z.object({
  sha: GitShaSchema.nullable().optional(),
  content: z.union([z.string(), z.instanceof(Uint8Array)])
});
