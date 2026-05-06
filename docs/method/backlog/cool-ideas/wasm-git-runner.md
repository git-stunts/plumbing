# COOL IDEA™: WASM Git Runner

## Context
`plumbing` currently requires a system-level Git binary installed and accessible via shell.

## Description
Implement a `CommandRunner` adapter that uses `isomorphic-git` or a WASM-compiled Git binary. This would allow `plumbing` to run in environments without a shell (e.g., standard browser, edge workers).

## Value
- Extends "Industrial Git" to the browser and serverless edge.
- Zero-dependency deployment for lightweight tools.
- Perfect for `@git-stunts/git-warp-web-inspector`.
