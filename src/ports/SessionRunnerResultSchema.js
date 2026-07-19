import { z } from 'zod';

const FUNCTION = z.custom((value) => typeof value === 'function', {
  message: 'Expected a function',
});

const READABLE_STREAM = z.custom(
  (value) =>
    value !== null &&
    typeof value === 'object' &&
    (typeof value.getReader === 'function' ||
      (typeof value.on === 'function' && typeof value[Symbol.asyncIterator] === 'function')),
  { message: 'Expected a Web or Node.js readable stream' }
);

const SESSION_COMPLETION = z
  .object({
    code: z.number().int(),
    stderr: z.string(),
    timedOut: z.boolean(),
    error: z.unknown().optional(),
    signal: z.union([z.string(), z.null()]).optional(),
    terminated: z.boolean().optional(),
  })
  .passthrough();

/**
 * Zod schema for the raw result returned by a CommandSessionRunner.
 */
export const SessionRunnerResultSchema = z.object({
  stdoutStream: READABLE_STREAM,
  finished: z.promise(SESSION_COMPLETION),
  write: FUNCTION,
  closeInput: FUNCTION,
  terminate: FUNCTION,
});

/**
 * @typedef {z.infer<typeof SessionRunnerResultSchema>} SessionRunnerResult
 */
