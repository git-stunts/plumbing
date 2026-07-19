# Architecture & Design

This project is built as a robust, low-level building block for Git-based applications. It follows strict engineering standards to ensure it is the most reliable Git plumbing library in the JavaScript ecosystem.

## 🏗️ Hexagonal Architecture (Ports & Adapters)

The codebase is strictly partitioned into three layers:

### 1. The Domain (Core)
Contains the business logic, entities, and value objects. It is **pure** and has zero dependencies on infrastructure or specific runtimes.
- **Entities**: `GitCommit`, `GitTree`, `GitBlob`.
- **Value Objects**: `GitSha`, `GitRef`, `GitFileMode`, `GitSignature`.
- **Services**: `CommandSanitizer` (security), `ExecutionOrchestrator` (retry/backoff), `GitErrorClassifier`, `GitPersistenceService`, `ByteMeasurer`.

### 2. The Ports (Contracts)
Functional interfaces that define how the domain interacts with the outside world.
- **`CommandRunner`**: A functional port defined in `src/ports/`. It enforces a strict contract: every command must return a `stdoutStream` and an `exitPromise`.
- **`CommandSessionRunner`**: An optional functional port for long-lived duplex processes. It returns writable input, streaming output, bounded stderr, explicit termination, and one completion promise. Existing one-shot runners remain valid without it.

### 3. The Adapters (Runtime Infrastructure)

Node.js, Bun, and Deno adapters implement both ports with their native process
and stream APIs. `ShellRunnerFactory.create()` preserves the original one-shot
contract; `createPorts()` exposes the one-shot runner and optional session
runner from the same adapter instance.

## 💉 Dependency Injection

Core services (`CommandSanitizer`, `ExecutionOrchestrator`) are designed as injectable instances. This allows developers to:
- Provide custom sanitization rules.
- Inject mock orchestrators for testing failure modes.
- Extend the `GitErrorClassifier` for specialized error handling.

## 🛡️ Defense-in-Depth Validation

We use **Zod** as our single source of truth for validation.
- **Schema Location**: All schemas reside in `src/domain/schemas/`.
- **Strict Enforcement**: No Entity or Value Object can be instantiated with invalid data. This ensures that errors are caught at the boundary, before any shell process is spawned.
- **JSON Schema Ready**: The Zod schemas are designed to be easily exportable to standard JSON schemas for cross-system interoperability.

## 🌊 Streaming and Bounded Sessions

In version 2.0.0, we eliminated the "buffered" execution path in the infrastructure layer. 
- **Consistency**: Every runner behaves exactly the same way.
- **Memory Safety**: Large outputs (like `cat-file` on a massive blob) never hit the heap unless explicitly requested via `collect()`.
- **OOM Protection**: The `collect()` method enforces a `maxBytes` limit, preventing malicious or accidental memory exhaustion.
- **Persistent Reads**: `GitCatFileSession` reuses `git cat-file --batch-command`, caps batches at 1,000 objects, and applies one cumulative content budget per call.
- **Incremental Trees**: `GitMktreeSession` writes iterable entries incrementally to `git mktree --batch -z` instead of assembling a duplicate tree buffer.
- **Bulk Imports**: `GitFastImportSession` keeps one `git fast-import` process alive across caller-bounded blob writes and explicit checkpoints.

## Session Ownership Boundary

Plumbing owns child-process lifecycle, stdin backpressure, bounded stderr,
timeouts, early-exit reporting, and raw Git protocol framing. Typed session
wrappers own protocol alignment and release their parser streams on close.

Plumbing deliberately does not own session pools, reuse duration, cache
admission, chunk sizing, object retention, leases, eviction, or materialization
policy. Those decisions belong to a storage layer such as
`@git-stunts/git-cas`. A session has no default timeout because only its owner
knows the valid operation lifetime; the owner must close or terminate it.

Injecting a custom one-shot runner does not silently combine it with the
built-in session runner. Callers that need both authorities must inject both
ports explicitly. A missing session port produces
`UnsupportedCapabilityError` rather than falling back to a different adapter.

## 🧩 Engineering Mandates

1. **One File = One Class**: Every file in `src/` represents a single logical concept. No "utils.js" or "types.js" dumping grounds.
2. **Total JSDoc**: 100% of the public API is documented with JSDoc, enabling excellent IDE intellisense and automated documentation generation.
3. **Immutability**: All Value Objects are immutable. Operations that "change" a state (like `GitTree.addEntry`) return a new instance.
4. **No Magic Literals**: Constants like the `Empty Tree SHA`, default timeouts (120s), and buffer limits are exported from the port layer.

## 🧪 Quality Assurance

- **Multi-Runtime CI**: We don't just "test in Node". Our CI environment (via Docker Compose) runs the exact same test suite in Bun and Deno simultaneously.
- **Tests as Spec**: Our tests define the behavior of the system. A change in logic requires a change in the corresponding test to ensure the "red -> green" story is preserved.
