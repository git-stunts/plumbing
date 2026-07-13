# @git-stunts/plumbing

[![npm version](https://img.shields.io/npm/v/@git-stunts/plumbing.svg)](https://www.npmjs.com/package/@git-stunts/plumbing)
[![License](https://img.shields.io/npm/l/@git-stunts/plumbing.svg)](LICENSE)
[![CI](https://github.com/git-stunts/plumbing/actions/workflows/ci.yml/badge.svg)](https://github.com/git-stunts/plumbing/actions/workflows/ci.yml)

> **The Industrial Foundation for Git-Based Subsystems.**

`@git-stunts/plumbing` is a low-level, environment-agnostic Git plumbing library designed for the modern JavaScript ecosystem. Built on **Hexagonal Architecture** and **Domain-Driven Design (DDD)** principles, it provides a secure, streaming-first, and type-safe interface for Git operations across **Node.js, Bun, and Deno**.

<img width="420" alt="Tux Plumber" src="https://github.com/user-attachments/assets/22e0e7e3-0587-48a8-aec5-6ec51e3d7fa6" align="right" />

## 🪠 Why Plumbing?

Most Git libraries are either high-level wrappers that leak implementation details or low-level bindings that are runtime-locked. `plumbing` treats Git as a **formal subsystem**, isolating your application from the complexities of shell execution, runtime differences, and security risks.

- **Environment Agnostic**: One API for Node, Bun, and Deno.
- **Async-First Architecture**: Modernized for v3.0, every initialization and execution path is asynchronous and non-blocking.
- **Streaming by Default**: Memory-efficient data handling using unified streams for all runtimes.
- **Defensive Engineering**: Built-in OOM protection, argument sanitization, and lock-contention retries.
- **Mathematical Integrity**: Powered by **Zod** validation to ensure every SHA, Ref, and Object is structurally sound before it touches the disk.

## 🛡️ Safety: Docker Mandate

To protect your host system from accidental corruption and ensure reproducible execution, **execution on the host is strictly prohibited.** This project uses `@git-stunts/docker-guard` to enforce isolation.

```bash
# Run the industrial test suite
docker-compose run --rm node-test
```

## 📦 Installation

```bash
npm install @git-stunts/plumbing
```

## 🛠️ Quick Start

### Async Initialization

Modern Git plumbing requires asynchronous initialization to safely validate the environment and working directory.

```javascript
import GitPlumbing from '@git-stunts/plumbing';

// Safely open a repository (Async factory)
const git = await GitPlumbing.createRepository({ cwd: './my-assets' });

// Execute a command with full telemetry and OOM protection
const status = await git.execute({ args: ['rev-parse', '--is-inside-work-tree'] });
console.log(`Ready: ${status}`);
```

### Atomic Commit Flow

Create blobs, trees, and commits programmatically without the fragility of manual shell scripts.

```javascript
import GitPlumbing, { GitSha } from '@git-stunts/plumbing';

const git = await GitPlumbing.createRepository({ cwd: './my-repo' });

const commitSha = await git.createCommitFromFiles({
  branch: 'refs/heads/main',
  message: 'Feat: immutable asset storage',
  author: { name: 'James Ross', email: 'james@flyingrobots.dev' },
  committer: { name: 'James Ross', email: 'james@flyingrobots.dev' },
  parents: [GitSha.from(await git.revParse({ revision: 'HEAD' }))],
  files: [
    { path: 'manifest.json', content: JSON.stringify({ version: '1.0' }) },
    { path: 'data.bin', content: new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]) }
  ]
});
```

### Non-Mutating Prune Inspection

Stream loose unreachable objects that Git considers older than a canonical UTC
cutoff. This API always invokes Git with `--dry-run`; unrestricted `git prune`
remains prohibited by the command sanitizer.

```javascript
const plumbing = await GitPlumbing.createDefault({ cwd: './my-repo' });
const stream = await plumbing.inspectPrunableObjects({
  expiresBefore: '2026-07-01T00:00:00.000Z'
});

for await (const chunk of stream) {
  // Parse Git's `<object-id> <type>` records incrementally.
}
await stream.finished;
```

## 📖 Deep Dives

- [**Standard Guide**](./GUIDE.md) - From zero to atomic commits.
- [**Advanced Guide**](./ADVANCED_GUIDE.md) - Custom runners, streaming internals, and performance tuning.
- [**Architecture**](./ARCHITECTURE.md) - Blueprints of the Hexagonal design.
- [**Recipes**](./docs/RECIPES.md) - Common patterns for Git-based applications.

## 📄 License

Apache-2.0
