import { z } from 'zod';

/**
 * Zod schema for the result returned by a CommandRunner.
 */
export const RunnerResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  code: z.number().optional().default(0),
});

/**
 * Zod schema for CommandRunner options.
 */
export const RunnerOptionsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  input: z.union([z.string(), z.instanceof(Buffer)]).optional(),
});

/**
 * @typedef {z.infer<typeof RunnerResultSchema>} RunnerResult
 * @typedef {z.infer<typeof RunnerOptionsSchema>} RunnerOptions
 */
