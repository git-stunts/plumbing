# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
