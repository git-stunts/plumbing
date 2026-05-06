# COOL IDEA™: Async Caching Layer

## Context
High-frequency operations (like TUIs or watchers) often call `rev-parse` or `cat-file` on the same objects repeatedly.

## Description
Implement an optional `CachingOrchestrator` that wraps the `ExecutionOrchestrator`. It would cache idempotent Git results (by SHA or Ref) with configurable TTL.

## Value
- Drastically reduces subprocess overhead for read-heavy apps.
- Improves TUI responsiveness.
- Protects against Git lock contention by reducing the frequency of shell calls.
