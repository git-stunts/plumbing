import { z } from 'zod';

/**
 * Default timeout for shell commands in milliseconds.
 */
export const DEFAULT_COMMAND_TIMEOUT = 120000;

/**
 * Default maximum size for command output buffer in bytes (10MB).
 */
export const DEFAULT_MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Default maximum size for stderr buffer in bytes (1MB).
 */
export const DEFAULT_MAX_STDERR_SIZE = 1024 * 1024;

/**
 * Zod schema for CommandRunner options.
 */
export const RunnerOptionsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  input: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().optional().default(DEFAULT_COMMAND_TIMEOUT),
});

/**
 * @typedef {z.infer<typeof RunnerOptionsSchema>} RunnerOptions
 */
