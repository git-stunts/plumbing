# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Domain Value Objects**: Added `GitSignature` and `GitFileMode` to formalize commit data and file modes.
- **Multi-Runtime Docker CI**: Parallel test execution for Node.js, Bun, and Deno using isolated "COPY-IN" containers.
- **Environment Detection**: `ShellRunnerFactory` now dynamically selects the appropriate adapter for Node, Bun, or Deno.
- **Domain Services**: Introduced `ByteMeasurer`, `CommandSanitizer`, and `GitCommandBuilder` to isolate responsibilities.
- **Dev Containers**: Provided specialized development environments for Node, Bun, and Deno.
- **Error Hierarchy**: Established a formal `GitPlumbingError` hierarchy (`ValidationError`, `InvalidArgumentError`, `InvalidGitObjectTypeError`).
- **Git Hooks**: Added `pre-commit` (linting) and `pre-push` (multi-runtime tests) via `core.hooksPath`.

### Changed
- **Architecture**: Enforced strict SRP and "one class per file" structure.
- **Security**: Hardened command execution with `CommandSanitizer` to prevent argument injection.
- **Stability**: Increased `NodeShellRunner` buffer limits to 100MB for handling large Git objects.
- **Reliability**: Added explicit Git binary verification on initialization.
- **Refactored Tests**: Migrated to a platform-agnostic testing strategy using global test functions.

### Fixed
- ReDoS vulnerability in `GitRef` validation regex.
- Stateful regex bug in `GitRef.isValid` caused by the global (`/g`) flag.
- Bug in `BunShellRunner` stdin handling by switching to standard stream writers.
- Cross-platform test failures by introducing a Deno compatibility shim.

### Removed
- Magic numbers and hardcoded strings throughout the codebase.
- Generic `Error` throws in favor of domain-specific exceptions.
- Hardcoded shell flags in entity logic.
