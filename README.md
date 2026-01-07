# @git-stunts/plumbing

A low-level, robust, and environment-agnostic Git plumbing library for the modern JavaScript ecosystem. Built with **Hexagonal Architecture** and **Domain-Driven Design (DDD)**, it provides a secure, streaming-first, and type-safe interface for Git operations across **Node.js, Bun, and Deno**.

## 🚀 Key Features

- **Streaming-First Architecture**: Unified "Streaming Only" pattern across all runtimes for consistent, memory-efficient data handling.
- **Multi-Runtime Support**: Native adapters for Node.js, Bun, and Deno with automatic environment detection.
- **Robust Schema Validation**: Powered by **Zod**, ensuring every Entity and Value Object is valid before use.
- **Hexagonal Architecture**: Strict separation between core domain logic and infrastructure adapters.
- **Execution Orchestration**: Centralized retry and lock-detection logic for maximum reliability.
- **OOM Protection**: Integrated safety buffering (`GitStream.collect`) with configurable byte limits.
- **Type-Safe Domain**: Formalized Value Objects for `GitSha`, `GitRef`, `GitFileMode`, and `GitSignature`.
- **Hardened Security**: Integrated `CommandSanitizer` to prevent argument injection attacks and `EnvironmentPolicy` for clean process isolation.
- **Environment Variable Isolation**: Strict whitelisting of Git-related environment variables (`GIT_AUTHOR_*`, `LANG`, etc.) to prevent leakage and ensure identity consistency.
- **Dockerized CI**: Parallel test execution across all runtimes using isolated containers.

## 📦 Installation

```bash
npm install @git-stunts/plumbing
```

## 🛠️ Usage

### Zero-Config Initialization

Version 2.0.0 introduces `createDefault()` which automatically detects your runtime and sets up the appropriate runner. Version 2.2.0 adds `createRepository()` for an even faster start.

```javascript
import GitPlumbing from '@git-stunts/plumbing';

// Get a high-level service in one line
const git = GitPlumbing.createRepository({ cwd: './my-repo' });

// Securely resolve references
const headSha = await git.revParse({ revision: 'HEAD' });
```

### Custom Runners

Extend the library for exotic environments like SSH or WASM.

```javascript
import GitPlumbing, { ShellRunnerFactory } from '@git-stunts/plumbing';

class MySshRunner {
  async run({ command, args }) { /* custom implementation */ }
}

ShellRunnerFactory.register('ssh', MySshRunner);

const git = GitPlumbing.createDefault({ env: 'ssh' });
```

### Core Entities

The library uses immutable Value Objects and Zod-validated Entities to ensure data integrity.

```javascript
import { GitSha, GitRef, GitSignature } from '@git-stunts/plumbing';

// Validate and normalize SHAs (throws ValidationError if invalid)
const sha = new GitSha('a1b2c3d4e5f67890123456789012345678901234');

// Safe reference handling (implements git-check-ref-format)
const mainBranch = GitRef.branch('main');

// Structured signatures
const author = new GitSignature({
  name: 'James Ross',
  email: 'james@flyingrobots.dev'
});
```

### Streaming Power

All commands are streaming-first. You can consume them as async iterables or collect them with safety guards.

```javascript
const stream = await git.executeStream({ args: ['cat-file', '-p', 'HEAD'] });

// Consume as async iterable
for await (const chunk of stream) {
  process.stdout.write(chunk);
}

// OR collect with OOM protection (default 10MB)
const output = await stream.collect({ maxBytes: 1024 * 1024, asString: true });
```

### Binary Support

You can now collect raw bytes to handle binary blobs without corruption.

```javascript
const stream = await git.executeStream({ args: ['cat-file', '-p', 'HEAD:image.png'] });
const buffer = await stream.collect({ asString: false }); // Returns Uint8Array
```

## 🏗️ Architecture

This project strictly adheres to modern engineering principles:
- **1 File = 1 Class/Concept**: Modular, focused files for maximum maintainability.
- **Dependency Inversion (DI)**: Domain logic depends on functional ports, not runtime-specific APIs.
- **No Magic Values**: All internal constants, timeouts, and buffer limits are centralized in the port layer.
- **Serializability**: Every domain object implements `toJSON()` for seamless interoperability.

For a deeper dive, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 📖 Documentation

- [**Architecture & Design**](./ARCHITECTURE.md) - Deep dive into the hexagonal architecture and design principles.
- [**Workflow Recipes**](./docs/RECIPES.md) - Step-by-step guides for common Git plumbing tasks (e.g., manual commits).
- [**Contributing**](./CONTRIBUTING.md) - Guidelines for contributing to the project.

## 🧪 Testing

We take cross-platform compatibility seriously. Our test suite runs in parallel across all supported runtimes using Docker.

```bash
npm test          # Multi-runtime Docker tests
npm run test:local # Local vitest run
```

## 💻 Development

### Dev Containers
Specialized environments are provided for each runtime. Open this project in VS Code and select a container:
- `.devcontainer/node`
- `.devcontainer/bun`
- `.devcontainer/deno`

### Git Hooks
- **Pre-commit**: Runs ESLint to ensure code style and SRP adherence.
- **Pre-push**: Runs the full Docker-based multi-runtime test suite.

## 📄 License

Apache-2.0