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

## [2.0.0] - 2026-01-07

### Refactor
- **Core Infrastructure for Production Stability**: Massive overhaul of the streaming and validation layers to support high-concurrency production workloads.
- **Security Layer & Service Decoupling**: Implemented strict environment and command isolation.
- **Orchestration & Error Handling**: Enhanced retry logic with total operation timeouts and robust error classification.

### Changed
- **GitStream Resource Management**: Replaced `FinalizationRegistry` with manual `try...finally` cleanup patterns to prevent `EMFILE` errors.
- **GitSha API Consolidation**: Consolidated validation into `GitSha.from(sha)` and improved error reporting.
- **ShellRunnerFactory Decoupling**: Added `register(name, RunnerClass)` for custom adapter registration (SSH/WASM).
- **Tooling**: Upgraded `vitest` to `^3.0.0`.

## [1.1.0] - 2026-01-07

### Added
- **Stream Completion Tracking**: Introduced `exitPromise` and `GitStream.finished`.
- **Resource Limits**: Implemented argument size and count limits in `CommandSanitizer`.

## [1.0.0] - 2025-10-15

### Added
- Initial release of the plumbing library.