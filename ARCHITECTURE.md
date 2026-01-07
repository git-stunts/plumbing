# Architecture & Design

This project is built as a core building block for the **Continuum** causal operating system. It follows strict engineering standards to ensure it is the most robust Git plumbing library in the JavaScript ecosystem.

## 🏗️ Hexagonal Architecture (Ports & Adapters)

The codebase is strictly partitioned into three layers:

### 1. The Domain (Core)
Contains the business logic, entities, and value objects. It is **pure** and has zero dependencies on infrastructure or specific runtimes.
- **Entities**: `GitCommit`, `GitTree`, `GitBlob`.
- **Value Objects**: `GitSha`, `GitRef`, `GitFileMode`, `GitSignature`.
- **Services**: `CommandSanitizer` (security), `ByteMeasurer`.

### 2. The Ports (Contracts)
Functional interfaces that define how the domain interacts with the outside world.
- **`CommandRunner`**: A functional port defined in `src/ports/`. It enforces a strict contract: every command must return a `stdoutStream` and an `exitPromise`.

### 3. The Infrastructure (Adapters)
Runtime-specific implementations of the ports.
- **Adapters**: `NodeShellRunner`, `BunShellRunner`, `DenoShellRunner`.
- **`GitStream`**: A universal wrapper that makes Node.js streams and Web Streams behave identically.

## 🛡️ Defense-in-Depth Validation

We use **Zod** as our single source of truth for validation.
- **Schema Location**: All schemas reside in `src/domain/schemas/`.
- **Strict Enforcement**: No Entity or Value Object can be instantiated with invalid data. This ensures that errors are caught at the boundary, before any shell process is spawned.
- **JSON Schema Ready**: The Zod schemas are designed to be easily exportable to standard JSON schemas for cross-system interoperability.

## 🌊 Streaming-Only Model

In version 2.0.0, we eliminated the "buffered" execution path in the infrastructure layer. 
- **Consistency**: Every runner behaves exactly the same way.
- **Memory Safety**: Large outputs (like `cat-file` on a massive blob) never hit the heap unless explicitly requested via `collect()`.
- **OOM Protection**: The `collect()` method enforces a `maxBytes` limit, preventing malicious or accidental memory exhaustion.

## 🧩 Engineering Mandates

1. **One File = One Class**: Every file in `src/` represents a single logical concept. No "utils.js" or "types.js" dumping grounds.
2. **Total JSDoc**: 100% of the public API is documented with JSDoc, enabling excellent IDE intellisense and automated documentation generation.
3. **Immutability**: All Value Objects are immutable. Operations that "change" a state (like `GitTree.addEntry`) return a new instance.
4. **No Magic Literals**: Constants like the `Empty Tree SHA`, default timeouts (120s), and buffer limits are exported from the port layer.

## 🧪 Quality Assurance

- **Multi-Runtime CI**: We don't just "test in Node". Our CI environment (via Docker Compose) runs the exact same test suite in Bun and Deno simultaneously.
- **Tests as Spec**: Our tests define the behavior of the system. A change in logic requires a change in the corresponding test to ensure the "red -> green" story is preserved.
