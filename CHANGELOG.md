# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-07

### Refactor
- **Core Infrastructure for Production Stability**: Massive overhaul of the streaming and validation layers to support high-concurrency production workloads.
- **Security Layer & Service Decoupling**: Implemented strict environment and command isolation.
- **Orchestration & Error Handling**: Enhanced retry logic with total operation timeouts and robust error classification.

### Changed
- **GitStream Resource Management**: Replaced `FinalizationRegistry` with manual `try...finally` cleanup patterns.
- **GitStream Performance**: Updated `collect()` to check if a chunk is already a `Uint8Array`.
- **GitSha API Consolidation**: Removed `isValid`, `fromString`, and `fromStringOrNull`. Consolidated into `GitSha.from(sha)`.
- **Enhanced Validation**: `GitSha.from` now throws `ValidationError` with help URLs.
- **ByteMeasurer Optimization**: Optimized for Node.js, Bun, and Deno runtimes.
- **CommandSanitizer Enhancement**: Converted to an injectable instance with an internal cache for repetitive commands. Blocks global flags before the subcommand.
- **EnvironmentPolicy Hardening**: Whitelists only essential variables and explicitly blocks `GIT_CONFIG_PARAMETERS`.
- **ShellRunnerFactory Decoupling**: Added `ShellRunnerFactory.register(name, RunnerClass)` for custom adapter registration.
- **ExecutionOrchestrator Total Timeout**: Implemented `totalTimeout` (Total Operation Timeout) that overrides retries if the total operation duration exceeds the limit.
- **GitErrorClassifier Enhancement**: Now uses regex for robust lock contention detection (`index.lock`) and supports constructor-injected `customRules` for extensible error handling.
- **GitPlumbing Decoupling**: Removed automatic instantiation of `GitRepositoryService` inside the `GitPlumbing` constructor to resolve a circular dependency.
- **GitBinaryChecker Extraction**: Extracted Git binary and work-tree verification logic into a dedicated `GitBinaryChecker` service, improving testability and allowing for easier mocking.
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