# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-07

### Refactor
- **Core Infrastructure for Production Stability**: Massive overhaul of the streaming and validation layers to support high-concurrency production workloads.

### Changed
- **GitStream Resource Management**: Replaced `FinalizationRegistry` with manual `try...finally` cleanup patterns. This prevents `EMFILE` (too many open files) errors that can occur under heavy load when garbage collection is not fast enough to release file handles.
- **GitStream Performance**: Updated `collect()` to check if a chunk is already a `Uint8Array`, avoiding redundant encoding operations.
- **GitSha API Consolidation**: Removed `isValid`, `fromString`, and `fromStringOrNull`. All SHA-1 validation is now consolidated into a single static `GitSha.from(sha)` method.
- **Enhanced Validation**: `GitSha.from` now catches Zod errors and throws a human-readable `ValidationError` including a help URL for Git object internals.
- **ByteMeasurer Optimization**: Optimized for Node.js, Bun, and Deno runtimes. Uses native `Buffer.byteLength` where available and shared `TextEncoder` instances elsewhere to minimize GC pressure.
- **Tooling**: Upgraded `vitest` to `^3.0.0` and updated `package.json` to version `2.0.0`.

### Added
- **Unified Streaming Architecture**: Refactored all shell runners (Node, Bun, Deno) to use a single "Streaming Only" pattern.
- **Exhaustive Zod Schemas**: Centralized validation in `src/domain/schemas` using Zod for all Entities and Value Objects.

## [1.1.0] - 2026-01-07

### Added
- **Stream Completion Tracking**: Introduced `exitPromise` to `CommandRunnerPort` and `GitStream.finished` to track command success/failure after stream consumption.
- **Resource Limits**: Implemented `MAX_ARGS`, `MAX_ARG_LENGTH`, and `MAX_TOTAL_LENGTH` in `CommandSanitizer`.

## [1.0.0] - 2025-10-15

### Added
- Initial release of the plumbing library.