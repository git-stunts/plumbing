import { z } from 'zod';

/**
 * Valid Git object type strings.
 */
export const GitObjectTypeStrings = z.enum([
  'blob',
  'tree',
  'commit',
  'tag',
  'ofs-delta',
  'ref-delta'
]);

/**
 * Valid Git object type integers.
 */
export const GitObjectTypeInts = z.union([
  z.literal(1), // blob
  z.literal(2), // tree
  z.literal(3), // commit
  z.literal(4), // tag
  z.literal(6), // ofs-delta
  z.literal(7)  // ref-delta
]);

/**
 * Zod schema for GitObjectType validation.
 */
export const GitObjectTypeSchema = z.union([GitObjectTypeStrings, GitObjectTypeInts]);
