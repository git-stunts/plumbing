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

const THENABLE = z.custom(
  (value) =>
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof value.then === 'function' &&
    typeof value.catch === 'function',
  { message: 'Expected a promise' }
);

/**
 * Zod schema for the raw result returned by a CommandSessionRunner.
 */
export const SessionRunnerResultSchema = z.object({
  stdoutStream: READABLE_STREAM,
  finished: THENABLE,
  write: FUNCTION,
  closeInput: FUNCTION,
  terminate: FUNCTION,
})
  // zod 4 cannot hold a promise-valued check inside a synchronous object parse.
  // Keep zod 3's z.promise() semantics: reject non-thenables now and validate
  // the completion when it settles.
  .transform((result) => ({
    ...result,
    finished: Promise.resolve(result.finished).then((completion) =>
      SESSION_COMPLETION.parse(completion)
    ),
  }));

/**
 * @typedef {z.infer<typeof SessionRunnerResultSchema>} SessionRunnerResult
 */
