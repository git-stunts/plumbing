# @git-stunts/plumbing

[![npm version](https://img.shields.io/npm/v/@git-stunts/plumbing.svg)](https://www.npmjs.com/package/@git-stunts/plumbing)
[![npm downloads](https://img.shields.io/npm/dm/@git-stunts/plumbing.svg)](https://www.npmjs.com/package/@git-stunts/plumbing)
[![CI](https://github.com/git-stunts/plumbing/actions/workflows/ci.yml/badge.svg)](https://github.com/git-stunts/plumbing/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@git-stunts/plumbing.svg)](LICENSE)

<img width="420" alt="Tux Plumber Chaos" src="https://github.com/user-attachments/assets/22e0e7e3-0587-48a8-aec5-6ec51e3d7fa6" align="right" />

A low-level, robust, and environment-agnostic Git plumbing library for the modern JavaScript ecosystem. Built with **Hexagonal Architecture** and **Domain-Driven Design (DDD)**, it provides a secure, streaming-first, and type-safe interface for Git operations across **Node.js, Bun, and Deno**.

### 🪠 Key Features

- **Streaming-First Architecture**: Unified "Streaming Only" pattern across all runtimes for consistent, memory-efficient data handling.
- **Multi-Runtime Support**: Native adapters for Node.js, Bun, and Deno with automatic environment detection.
- **Robust Schema Validation**: Powered by **Zod**, ensuring every Entity and Value Object is valid before use.
- **Hexagonal Architecture**: Strict separation between core domain logic and infrastructure adapters.
- **Dependency Injection**: Core services like `CommandSanitizer` and `ExecutionOrchestrator` are injectable for maximum testability.
- **Hardened Security**: Integrated `CommandSanitizer` and `EnvironmentPolicy` to prevent argument injection and environment leakage.
- **OOM Protection**: Integrated safety buffering (`GitStream.collect`) with configurable byte limits.
- **Dockerized CI**: Parallel test execution across all runtimes using isolated containers.

## 🛡️ Safety First: Docker Execution

This library performs low-level Git manipulations. To protect your host system and ensure a reproducible environment, **execution on the host is strictly prohibited.**

All tests and commands should be run inside the provided Docker containers:

```bash
docker-compose run --rm node-test
```

The system will automatically fail if `GIT_STUNTS_DOCKER=1` is not set.

We load `@git-stunts/docker-guard` (v0.1.0+) before every suite (`test/support/ensure-docker.js`), so invoking `ensureDocker()` happens automatically for Vitest/Bun/Deno. You can copy the same pattern in other packages:

```javascript
import { ensureDocker } from '@git-stunts/docker-guard';

ensureDocker();
```

## 🏗️ Design Principles

1.  **Git as a Subsystem**: Git is treated as an external, untrusted dependency. Every command and environment variable is sanitized.
2.  **Streaming-First**: Buffering is a choice, not a requirement. All data flows through streams to ensure scalability.
3.  **Domain Purity**: Core logic is 100% environment-agnostic. Runtimes are handled by decoupled adapters.
4.  **Security by Default**: Prohibits dangerous global flags and restricts the environment to minimize the attack surface.

## 📋 Prerequisites & Compatibility

- **System Git**: Requires Git >= 2.30.0.
- **Runtimes**:
    - **Node.js**: >= 20.0.0
    - **Bun**: >= 1.3.5
    - **Deno**: >= 2.0.0

## 📦 Installation

```bash
npm install @git-stunts/plumbing
```

## 🛠️ Usage

### Zero-Config Initialization

```javascript
import GitPlumbing from '@git-stunts/plumbing';

// Get a high-level service in one line
// GitRepositoryService is a convenience facade built on plumbing primitives.
const git = GitPlumbing.createRepository({ cwd: './my-repo' });
```

### ⚡ Killer Example: Atomic Commit from Scratch

Orchestrate a full commit sequence—from hashing blobs to updating references—with built-in concurrency protection.

```javascript
import GitPlumbing, { GitSha } from '@git-stunts/plumbing';

const git = GitPlumbing.createRepository({ cwd: './my-repo' });

const commitSha = await git.createCommitFromFiles({
  branch: 'refs/heads/main',
  message: 'Feat: atomic plumbing commit',
  author: { name: 'James Ross', email: 'james@flyingrobots.dev' },
  committer: { name: 'James Ross', email: 'james@flyingrobots.dev' },
  parents: [GitSha.from(await git.revParse({ revision: 'HEAD' }))],
  files: [
    { path: 'hello.txt', content: 'Hello World' },
    { path: 'script.sh', content: '#!/bin/sh\necho hi', mode: '100755' }
  ],
  concurrency: 10 // Parallelize blob creation safely
});
```

### Core Entities

```javascript
import { GitSha } from '@git-stunts/plumbing/sha';
import { GitRef } from '@git-stunts/plumbing/ref';
import { GitSignature } from '@git-stunts/plumbing/signature';

// Validate and normalize (throws ValidationError if invalid)
const sha = GitSha.from('a1b2c3d4...');
const mainBranch = GitRef.branch('main');
```

## 📖 Documentation

- [**Git Commit Lifecycle**](./docs/COMMIT_LIFECYCLE.md) - **Recommended**: A step-by-step guide to building and persisting Git objects.
- [**Custom Runners**](./docs/CUSTOM_RUNNERS.md) - How to implement and register custom execution adapters (SSH/WASM).
- [**Security Model**](./SECURITY.md) - Rationale behind our security policies and constraints.
- [**Workflow Recipes**](./docs/RECIPES.md) - Common Git plumbing tasks.

## 🧪 Testing

```bash
npm test          # Multi-runtime Docker tests
npm run test:local # Local vitest run
```

## 📄 License

Apache-2.0
