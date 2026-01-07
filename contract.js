import { z } from 'zod';

/**
 * Zod schema for the result returned by a CommandRunner.
 */
export const RunnerResultSchema = z.object({
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  code: z.number().optional().default(0),
  stdoutStream: z.any().optional(), // ReadableStream or similar
});

/**
 * Zod schema for CommandRunner options.
 */
export const RunnerOptionsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  input: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
  timeout: z.number().optional().default(120000), // Increased to 120s for Docker CI
  stream: z.boolean().optional().default(false),
});

/**
 * @typedef {z.infer<typeof RunnerResultSchema>} RunnerResult
 * @typedef {z.infer<typeof RunnerOptionsSchema>} RunnerOptions
 */

/**
 * @typedef {function(RunnerOptions): Promise<RunnerResult>} CommandRunner
 */