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
cutoff. This API always invokes Git with `--dry-run --no-progress`;
unrestricted `git prune` remains prohibited by the command sanitizer.

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

### Persistent Git Protocol Sessions

Repeated object operations can share one stock Git process. The typed session
wrappers handle protocol framing while preserving explicit lifecycle ownership:

```javascript
const plumbing = await GitPlumbing.createDefault({ cwd: './my-repo' });
const objects = await plumbing.openCatFileSession();

try {
  const metadata = await objects.infoMany([firstOid, secondOid]);
  const values = await objects.readMany([firstOid, secondOid], {
    maxBytes: 8 * 1024 * 1024
  });
  for (const { oid, type, content } of values) {
    consume(oid, type, content);
  }
} finally {
  await objects.close();
}
```

`maxBytes` is a cumulative content budget for `readMany()`. A response that
exceeds the remaining budget is drained without being retained, the operation
fails with `OBJECT_BUFFER_LIMIT_EXCEEDED`, and the session remains aligned for
later requests. The default budget is 10 MiB.

Additional typed protocols are available through `openMktreeSession()` and
`openFastImportSession()`. A single tree supplied to `write()` remains iterable
or async iterable and is streamed without constructing a second whole-tree
buffer. `writeMany()` assembles one bounded framed write for up to 256
independent trees, while `writeBlobs()` assembles one bounded protocol write for
up to 256 blobs under a caller-selectable content budget capped at 64 MiB.
`infoMany()` accepts up to 1,000 object names under a 64 KiB command budget. All
batch results preserve input order.

`openUpdateRefSession()` reuses one `git update-ref --stdin` process across
explicit compare-and-swap transactions. Its `update()` method accepts
`expectedOldOid: null` for create-only semantics, omits the check only when the
field is `undefined`, and validates Git's ordered start/prepare/commit
acknowledgements. A rejected or malformed transaction poisons the session.
`noDeref` is explicit; on the minimum supported Git, consumers must retain any
separate symbolic-ref safety check they require.

Sessions have no implicit timeout. Their owner must call `close()` for orderly
completion or `terminate()`/`abort()` when abandoning work. Plumbing owns the
process and Git protocol mechanics only; callers such as `@git-stunts/git-cas`
own pooling, chunking, caching, retention, and eviction policy.

The Docker-only microbenchmark compares one-at-a-time operations with bounded
batch windows or a persistent ref session against fresh SHA-256 repositories.
It records elapsed time, Git process topology, stdin write count, and exact
object-identity witnesses:

```bash
docker compose run --build --rm node-test npm run benchmark:protocol-sessions
```

## 📖 Deep Dives

- [**Standard Guide**](./GUIDE.md) - From zero to atomic commits.
- [**Advanced Guide**](./ADVANCED_GUIDE.md) - Custom runners, streaming internals, and performance tuning.
- [**Architecture**](./ARCHITECTURE.md) - Blueprints of the Hexagonal design.
- [**Recipes**](./docs/RECIPES.md) - Common patterns for Git-based applications.
- [**Custom Runners**](./docs/CUSTOM_RUNNERS.md) - One-shot and optional duplex runner contracts.

## 📄 License

Apache-2.0
