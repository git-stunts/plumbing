# BAD CODE: GitPersistenceService Large Tree Overhead

## Context
`GitPersistenceService.writeTree` (and `createCommitFromFiles`) aggregates all tree entries into a single array before writing.

## Symptoms
For massive trees (100k+ entries), this causes high peak memory usage and potentially blocks the event loop during stringification.

## Proposed Fix
Implement a streaming Tree Builder that can pipe entries directly to `git mktree` using the `stdout` of a generator, maintaining a constant memory footprint.
