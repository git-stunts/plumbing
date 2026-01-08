# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2026-01-07

### Added
- **GitRepositoryService.save()**: Introduced a polymorphic persistence method that automatically delegates to the appropriate low-level operation based on the entity type (Blob, Tree, or Commit).
- **Commit Lifecycle Guide**: Created `docs/COMMIT_LIFECYCLE.md`, a step-by-step tutorial covering manual graph construction and persistence.

### Changed
- **Documentation Overhaul**: Updated `README.md` with enhanced security details and prominent links to the new lifecycle guide.
- **Process Isolation**: Hardened shell runners with strict environment variable whitelisting and support for per-call overrides.
- **Runtime Optimization**: Updated `ByteMeasurer` to use `Buffer.byteLength` where available and pinned Deno to 2.6.3 in development environments.
- **Improved Validation**: Enhanced `GitRefSchema` to strictly follow Git's naming rules, including better handling of control characters and '@' symbol sequences.

### Fixed
- **Node.js Shell Stability**: Resolved a critical bug in `NodeShellRunner` where processes were killed immediately if no timeout was specified.
- **Backoff Logic**: Fixed an off-by-one error in `ExecutionOrchestrator` that caused incorrect delay calculations during retries.
- **Type Safety**: Added type validation to `CommandSanitizer` to prevent `TypeError` when receiving non-string arguments.
- **Object Mapping**: Fixed a bug in `GitObjectType` where delta types were incorrectly mapped to strings instead of integers.
- **CI/CD Reliability**: Fixed GitHub Actions workflow by adding missing Node.js setup and dependency installation steps to the multi-runtime test job.
- **Persistence Accuracy**: Fixed incorrect tree entry type detection in `GitPersistenceService` that could cause tree corruption.

## [2.5.0] - 2026-01-05

### Added
- **GitCommandBuilder Fluent API**: Added static factory methods for all whitelisted Git commands (e.g., `.hashObject()`, `.catFile()`, `.writeTree()`) and fluent flag methods (e.g., `.stdin()`, `.write()`, `.pretty()`) for a more expressive command-building experience.

### Changed
- **GitPlumbing DI Support**: Updated the constructor to accept optional `sanitizer` and `orchestrator` instances, enabling full Dependency Injection for easier testing and customization of core logic.

## [2.4.0] - 2026-01-03

### Added
- **GitErrorClassifier**: Extracted error categorization logic from the orchestrator into a dedicated domain service. Uses regex and exit codes (e.g., 128) to identify lock contention and state issues.
- **ProhibitedFlagError**: New specialized error thrown when restricted Git flags (like `--work-tree`) are detected, providing remediation guidance and documentation links.
- **Dynamic Command Registration**: Added `CommandSanitizer.allow(commandName)` to permit runtime extension of the allowed plumbing command list.

### Changed
- **Dependency Injection (DI)**: Refactored `CommandSanitizer` and `ExecutionOrchestrator` into injectable class instances, improving testability and modularity of the `GitPlumbing` core.
- **Sanitizer Memoization**: Implemented an internal LRU-ish cache in `CommandSanitizer` to skip re-validation of identical repetitive commands, improving performance for high-frequency operations.
- **Enhanced Deno Shim**: Updated the test shim to include `beforeEach`, `afterEach`, and other lifecycle hooks for full parity with Vitest.

## [2.3.0] - 2026-01-01

### Changed
- **Validation Unification**: Completed the migration from `ajv` to `zod` for the entire library, reducing bundle size and unifying the type-safety engine.
- **Security Hardening**: Expanded the `EnvironmentPolicy` whitelist to include `GIT_AUTHOR_TZ`, `GIT_COMMITTER_TZ`, and localization variables (`LANG`, `LC_ALL`, etc.) to ensure identity and encoding consistency.
- **Universal Testing**: Updated the multi-runtime test suite to ensure 100% test parity across Node.js, Bun, and Deno, specifically adding missing builder and environment tests.

### Added
- **EnvironmentPolicy**: Extracted environment variable whitelisting into a dedicated domain service used by all shell runners.

## [2.2.0] - 2025-12-28

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

## [2.1.0] - 2025-12-20

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

## [2.0.0] - 2025-12-10

### Added
- Initial release of the plumbing library.
