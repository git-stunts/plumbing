import { z } from 'zod';

/**
 * Zod schema for the result returned by a CommandRunner.
 */
export const RunnerResultSchema = z.object({
  stdoutStream: z.any(), // ReadableStream (Web) or Readable (Node)
  exitPromise: z.instanceof(Promise), // Resolves to {code, stderr} when process ends
});

/**
 * @typedef {z.infer<typeof RunnerResultSchema>} RunnerResult
 */
