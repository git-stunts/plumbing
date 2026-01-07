import { z } from 'zod';

/**
 * Valid Git file mode strings.
 */
export const GitFileModeSchema = z.enum([
  '100644', // REGULAR
  '100755', // EXECUTABLE
  '120000', // SYMLINK
  '040000', // TREE
  '160000'  // COMMIT (Submodule)
]);
