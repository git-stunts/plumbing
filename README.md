# @git-stunts/plumbing

A low-level, robust, and environment-agnostic Git plumbing library for the modern JavaScript ecosystem. Built with Hexagonal Architecture and Domain-Driven Design (DDD), it provides a secure and type-safe interface for Git operations across **Node.js, Bun, and Deno**.

## 🚀 Key Features

- **Multi-Runtime Support**: Native adapters for Node.js, Bun, and Deno with automatic environment detection.
- **Hexagonal Architecture**: Strict separation between core domain logic and infrastructure adapters.
- **Type-Safe Domain**: Formalized Value Objects for `GitSha`, `GitRef`, `GitFileMode`, and `GitSignature`.
- **Harden Security**: Integrated `CommandSanitizer` to prevent argument injection attacks.
- **Robust Error Handling**: Domain-specific error hierarchy (`ValidationError`, `InvalidArgumentError`, etc.).
- **Dockerized CI**: Parallel test execution across all runtimes using isolated containers.
- **Developer Ergonomics**: Pre-configured Dev Containers and Git hooks for a seamless workflow.

## 📦 Installation

```bash
npm install @git-stunts/plumbing
```

## 🛠️ Usage

### Core Entities

The library uses immutable Value Objects to ensure data integrity before any shell command is executed.

```javascript
import { GitSha, GitRef, GitSignature } from '@git-stunts/plumbing';

// Validate and normalize SHAs
const sha = new GitSha('a1b2c3d4e5f67890123456789012345678901234');

// Safe reference handling
const mainBranch = GitRef.branch('main');

// Structured signatures
const author = new GitSignature({
  name: 'James Ross',
  email: 'james@flyingrobots.dev'
});
```

### Executing Commands

`GitPlumbing` follows Dependency Inversion, allowing you to provide a custom runner or use the auto-detecting `ShellRunner`.

```javascript
import GitPlumbing from '@git-stunts/plumbing';
import ShellRunner from '@git-stunts/plumbing/ShellRunner';

const git = new GitPlumbing({ 
  runner: ShellRunner.run,
  cwd: './my-repo'
});

// Securely resolve references
const headSha = await git.revParse({ revision: 'HEAD' });

// Update references
await git.updateRef({ 
  ref: 'refs/heads/feature', 
  newSha: '...' 
});
```

## 🏗️ Architecture

This project strictly adheres to modern engineering principles:
- **One Class Per File**: For maximum maintainability.
- **Single Responsibility Principle (SRP)**: Logic is isolated into Domain Entities, Value Objects, and Services.
- **No Magic Values**: All internal constants and modes are encapsulated in static class properties.

```text
src/
├── domain/
│   ├── entities/       # GitBlob, GitCommit, GitTree, GitTreeEntry
│   ├── value-objects/  # GitSha, GitRef, GitFileMode, GitSignature
│   └── services/       # CommandSanitizer, ByteMeasurer
├── infrastructure/
│   ├── adapters/       # node, bun, deno implementations
│   └── factories/      # ShellRunnerFactory
└── ports/              # Interfaces and contracts
```

## 🧪 Testing

We take cross-platform compatibility seriously. Our test suite runs in parallel across all supported runtimes using Docker.

### Multi-Runtime Tests (Docker)
This command spawns three isolated containers (Node, Bun, Deno) and verifies the entire library in parallel.
```bash
npm test
```

### Local Testing
```bash
npm run test:local
```

## 💻 Development

### Dev Containers
Specialized environments are provided for each runtime. Open this project in VS Code and select a container:
- `.devcontainer/node`
- `.devcontainer/bun`
- `.devcontainer/deno`

### Git Hooks
The project uses `core.hooksPath` to enforce quality:
- **Pre-commit**: Runs ESLint to ensure code style.
- **Pre-push**: Runs the full Docker-based multi-runtime test suite.

## 📄 License

Apache-2.0
