import { z } from 'zod';

/**
 * Zod schema for GitSignature validation.
 */
export const GitSignatureSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  timestamp: z.number().int().nonnegative().default(() => Math.floor(Date.now() / 1000))
});
