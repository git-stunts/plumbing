# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-01-07

### Added
- **GitErrorClassifier**: Extracted error categorization logic from the orchestrator into a dedicated domain service. Uses regex and exit codes (e.g., 128) to identify lock contention and state issues.
- **ProhibitedFlagError**: New specialized error thrown when restricted Git flags (like `--work-tree`) are detected, providing remediation guidance and documentation links.
- **Dynamic Command Registration**: Added `CommandSanitizer.allow(commandName)` to permit runtime extension of the allowed plumbing command list.

### Changed
- **Dependency Injection (DI)**: Refactored `CommandSanitizer` and `ExecutionOrchestrator` into injectable class instances, improving testability and modularity of the `GitPlumbing` core.
- **Sanitizer Memoization**: Implemented an internal LRU-ish cache in `CommandSanitizer` to skip re-validation of identical repetitive commands, improving performance for high-frequency operations.
- **Enhanced Deno Shim**: Updated the test shim to include `beforeEach`, `afterEach`, and other lifecycle hooks for full parity with Vitest.

## [2.3.0] - 2026-01-07

### Changed
- **Validation Unification**: Completed the migration from `ajv` to `zod` for the entire library, reducing bundle size and unifying the type-safety engine.
- **Security Hardening**: Expanded the `EnvironmentPolicy` whitelist to include `GIT_AUTHOR_TZ`, `GIT_COMMITTER_TZ`, and localization variables (`LANG`, `LC_ALL`, etc.) to ensure identity and encoding consistency.
- **Universal Testing**: Updated the multi-runtime test suite to ensure 100% test parity across Node.js, Bun, and Deno, specifically adding missing builder and environment tests.

### Added
- **EnvironmentPolicy**: Extracted environment variable whitelisting into a dedicated domain service used by all shell runners.

## [2.2.0] - 2026-01-07

### Added
- **ExecutionOrchestrator**: Extracted command execution lifecycle (retry, backoff, lock detection) into a dedicated domain service to improve SRP compliance.
- **Binary Stream Support**: Refactored `GitStream.collect()` to support raw `Uint8Array` accumulation, preventing corruption of non-UTF8 binary data (e.g., blobs, compressed trees).
- **GitRepositoryLockedError**: Introduced a specialized error for repository lock contention with remediation guidance.
- **CommandRetryPolicy**: Added a new value object to encapsulate configurable retry strategies and backoff logic.
- **Custom Runner Registration**: Added `ShellRunnerFactory.register()` to allow developers to inject custom shell execution logic (e.g., SSH, WASM).
- **Environment Overrides**: `GitPlumbing.createDefault()` and `ShellRunnerFactory.create()` now support explicit environment overrides.
- **Repository Factory**: Added `GitPlumbing.createRepository()` for single-line high-level service instantiation.
- **Workflow Recipes**: Created `docs/RECIPES.md` providing step-by-step guides for low-level Git workflows (e.g., 'Commit from Scratch').

### Changed
- **Memory Optimization**: Enhanced `GitStream.collect()` to use chunk-based accumulation with `Uint8Array.set()`, reducing redundant string allocations during collection.
- **Runtime Performance**: Optimized `ByteMeasurer` to use `Buffer.byteLength()` in Node.js and Bun, significantly improving performance for large string measurements.
- **Development Tooling**: Upgraded `vitest` to version 3.0.0 for improved testing capabilities and performance.

## [2.1.0] - 2026-01-07

### Added
- **GitRepositoryService**: Extracted high-level repository operations (`revParse`, `updateRef`, `deleteRef`) into a dedicated domain service.
- **Resilience Layer**: Implemented exponential backoff retry logic for Git lock contention (`index.lock`) in `GitPlumbing.execute`.
- **Telemetric Trace IDs**: Added automatic and manual `traceId` correlation across command execution for production traceability.
- **Performance Monitoring**: Integrated latency tracking for all Git command executions.
- **Secure Runtime Adapters**: Implemented "Clean Environment" isolation in Node, Bun, and Deno runners, preventing sensitive env var leakage.
- **Resource Lifecycle Management**: Enhanced `GitStream` with `FinalizationRegistry` and `destroy()` for deterministic cleanup of shell processes.

### Changed
- **Entity Unification**: Refactored `GitTreeEntry` to use object-based constructors, standardizing the entire domain entity API.
- **Hardened Sanitizer**: Strengthened `CommandSanitizer` to block configuration overrides (`-c`, `--config`) globally and expanded the plumbing command whitelist.
- **Enhanced Verification**: `GitPlumbing.verifyInstallation` now validates both the Git binary and the repository integrity of the current working directory.

### Fixed
- **Deno Resource Leaks**: Resolved process leaks in Deno by ensuring proper stream consumption across all test cases.
- **Node.js Stream Performance**: Optimized async iteration in `GitStream` using native protocols.

## [2.0.0] - 2026-01-07

### Added
- **Unified Streaming Architecture**: Refactored all shell runners (Node, Bun, Deno) to use a single "Streaming Only" pattern, simplifying the adapter layer and port interface.
- **Exhaustive Zod Schemas**: Centralized validation in `src/domain/schemas` using Zod for all Entities and Value Objects.
- **Safety Buffering**: Added `GitStream.collect({ maxBytes })` with default 10MB limit to prevent OOM during large command execution.
- **Runtime Factory**: Added `GitPlumbing.createDefault()` for zero-config instantiation in Node, Bun, and Deno.

### Changed
- **Strict Hexagonal Architecture**: Enforced strict dependency inversion by passing the runner port to domain services.
- **1 Class per File**: Reorganized the codebase to strictly adhere to the "one class per file" mandate.
- **Magic Number Elimination**: Replaced all hardcoded literals (timeouts, buffer sizes, SHA constants) with named exports in the ports layer.
- **Bound Context**: Ensured `ShellRunnerFactory` returns bound methods to prevent `this` context loss in production.

### Fixed
- **Performance**: Optimized `GitStream` for Node.js by using native `Symbol.asyncIterator` instead of high-frequency listener attachments.
- **Validation**: Fixed incomplete Git reference validation by implementing the full `git-check-ref-format` specification via Zod.

## [1.1.0] - 2026-01-07

### Added
- **Stream Completion Tracking**: Introduced `exitPromise` to `CommandRunnerPort` and `GitStream.finished` to track command success/failure after stream consumption.
- **Resource Limits**: Implemented `MAX_ARGS`, `MAX_ARG_LENGTH`, and `MAX_TOTAL_LENGTH` in `CommandSanitizer` to prevent resource exhaustion attacks.

### Changed
- **Security Hardening**: Restricted `CommandSanitizer` to Git-only commands (removed `sh`, `cat`) and added 12+ prohibited Git flags (e.g., `--exec-path`, `--config`, `--work-tree`).
- **Universal Timeout**: Applied execution timeouts to streaming mode across all adapters (Node, Bun, Deno).

### Fixed
- **Test Integrity**: Corrected critical race conditions in the test suite by ensuring all async Git operations are properly awaited.
- **Streaming Reliability**: Fixed Deno streaming adapter to capture stderr without conflicting with stdout consumption.

## [1.0.0] - 2025-10-15

### Added
