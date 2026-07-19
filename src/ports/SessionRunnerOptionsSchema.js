import { z } from 'zod';
import { DEFAULT_MAX_STDERR_SIZE } from './RunnerOptionsSchema.js';

/**
 * Zod schema for opening a long-lived command session.
 *
 * Sessions deliberately have no default timeout. Their owner controls their
 * lifecycle and may opt into a timeout explicitly.
 */
export const SessionRunnerOptionsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  maxStderrBytes: z.number().int().positive().default(DEFAULT_MAX_STDERR_SIZE),
  timeout: z.number().int().positive().max(2_147_483_647).optional(),
});

/**
 * @typedef {z.infer<typeof SessionRunnerOptionsSchema>} SessionRunnerOptions
 */
