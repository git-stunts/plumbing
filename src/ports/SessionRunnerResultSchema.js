import { z } from 'zod';

const FUNCTION = z.custom((value) => typeof value === 'function', {
  message: 'Expected a function',
});

/**
 * Zod schema for the raw result returned by a CommandSessionRunner.
 */
export const SessionRunnerResultSchema = z.object({
  stdoutStream: z.any(),
  finished: z.instanceof(Promise),
  write: FUNCTION,
  closeInput: FUNCTION,
  terminate: FUNCTION,
});

/**
 * @typedef {z.infer<typeof SessionRunnerResultSchema>} SessionRunnerResult
 */
