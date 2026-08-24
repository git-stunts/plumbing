# Advanced Plumbing Guide

This guide is for engineers building high-performance, multi-runtime, or distributed Git systems on top of `@git-stunts/plumbing`.

## 1. Unified Streaming Architecture

Unlike many Git libraries that offer a "buffered vs. streaming" choice, `plumbing` infrastructure is **streaming-first**. Every command runner (Node, Bun, Deno) returns a unified `GitStream`.

### Consuming the Stream

The `executeStream` method returns a `GitStream` wrapper that implements the `AsyncIterable` protocol.

```javascript
const stream = await git.executeStream({
  args: ['cat-file', '-p', largeSha],
});

for await (const chunk of stream) {
  // Process 64KB chunks as they arrive from the Git process
  processChunk(chunk);
}

const result = await stream.finished;
console.log(`Exit code: ${result.code}`);
```

## 2. Custom Execution Adapters (Runners)

`plumbing` uses Hexagonal Architecture to separate domain logic from shell execution. You can register custom runners to execute Git commands over SSH, WASM, or even via a remote agent.

### Implementing a Runner

A runner is a function that satisfies the `CommandRunner` port:

```javascript
/**
 * @param {import('./src/ports/RunnerOptionsSchema.js').RunnerOptions} options
 * @returns {Promise<import('./src/ports/CommandRunnerPort.js').RunnerResult>}
 */
async function myCustomSSHRunner(options) {
  // 1. Establish SSH connection
  // 2. Spawn remote 'git' command
  // 3. Return the remote stdout stream and a completion promise
}
```

### Registering your Runner

Use the `ShellRunnerFactory` to register your adapter:

```javascript
import { ShellRunnerFactory } from '@git-stunts/plumbing';

ShellRunnerFactory.register('ssh-cloud', MyCustomSSHRunner);

const git = await GitPlumbing.createRepository({
  cwd: '/remote/path',
  env: 'ssh-cloud', // Use the registered name
});
```

## 3. Persistent Git Protocol Sessions

Use typed protocol sessions when repeated object operations would otherwise
spawn one Git process per request:

```javascript
const objects = await git.openCatFileSession();
try {
  const metadata = await objects.infoMany(oids);
  const values = await objects.readMany(oids, { maxBytes: 4 * 1024 * 1024 });
  processObjects(metadata, values);
} finally {
  await objects.close();
}
```

The available wrappers are:

- `openCatFileSession()`: Repeated metadata and bounded content reads through
  `git cat-file --batch-command`.
- `openMktreeSession()`: Incremental iterable tree writes through
  `git mktree --batch -z`.
- `openFastImportSession()`: Caller-bounded blob writes and explicit checkpoints
  through `git fast-import`.
- `openUpdateRefSession()`: Repeated explicit compare-and-swap transactions
  through `git update-ref --stdin`.

`read()` buffers at most its `maxBytes` budget. `readMany()` applies that budget
to the total retained content, not independently to every object. A rejected
oversized response is drained so the process remains usable. Callers handling
objects larger than the budget should chunk them at their storage boundary.

The session batch surfaces pipeline requests before consuming their ordered
responses:

```javascript
const blobs = await git.openFastImportSession();
const trees = await git.openMktreeSession();
try {
  const blobOids = await blobs.writeBlobs(payloads, {
    maxBytes: 32 * 1024 * 1024,
  });
  await blobs.checkpoint();
  const treeOids = await trees.writeMany(treeEntryGroups);
  consumeObjectIds(blobOids, treeOids);
} finally {
  await Promise.all([blobs.close(), trees.close()]);
}
```

`infoMany()` accepts at most 1,000 names and 64 KiB of commands.
`writeBlobs()` accepts at most 256 blobs and 64 MiB of content; callers may
lower the byte ceiling. `writeMany()` accepts at most 256 trees, 65,536 total
entries, and 64 MiB of framed input. The write batches are assembled into one
bounded stdin chunk before protocol state changes; this both gives validation
failures a reusable-session boundary and removes per-object JavaScript writes.
These fixed ceilings also bound pending protocol responses so a batch cannot
fill the child-process stdout pipe before the reader begins consuming it.

Fast-import blobs become externally visible after `checkpoint()` or `close()`.
Always close typed sessions in `finally`. Raw `openSession()` callers must also
consume or destroy `session.stdout`, close input or terminate the process, and
await `session.finished`.

These wrappers do not pool themselves. A higher storage layer decides whether
to reuse, expire, or replace a session and owns all cache and retention policy.

Ref transactions validate `start: ok`, `prepare: ok`, and `commit: ok` before
returning. A CAS rejection ends the Git process and poisons the typed session;
the owning storage layer decides whether and when to open a replacement. Passing
`expectedOldOid: null` requires the ref to be absent, while `undefined` requests
an unconditional update. Set `noDeref: true` only when overwriting the named ref
itself is intended. Git versions in the minimum support range do not expose the
newer `symref-verify` protocol command, so a consumer that forbids symbolic refs
must keep its own preflight rather than treating `noDeref` as a type check.

## 4. Resilience & Retry Policies

Lock contention (`index.lock`) is a common failure mode in concurrent Git operations. `plumbing` includes an `ExecutionOrchestrator` that handles retries with exponential backoff.

```javascript
import { CommandRetryPolicy } from '@git-stunts/plumbing';

const customPolicy = new CommandRetryPolicy({
  maxRetries: 5,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  totalTimeoutMs: 10000,
});

await git.execute({
  args: ['update-ref', 'refs/heads/main', newSha],
  retryPolicy: customPolicy,
});
```

## 5. Telemetry & Observability

Every command executed through `GitPlumbing` carries a `traceId`. You can use this to correlate logs across distributed systems.

```javascript
const traceId = `request-${Date.now()}`;

await git.execute({
  args: ['rev-parse', 'HEAD'],
  traceId,
});

// The traceId is passed into the CommandRunner and is available in
// GitPlumbingError if the command fails.
```

## 6. Runtime-Specific Nuances

While the API is unified, the underlying adapters optimize for each runtime:

- **Node.js**: Uses `node:child_process` with native stream piping.
- **Bun**: Uses `Bun.spawn` but falls back to Node compatibility mode for certain I/O edge cases to ensure reliability.
- **Deno**: Uses `Deno.Command` with native readable streams.

`plumbing` automatically detects the environment, but you can override it during initialization if needed:

```javascript
const git = await GitPlumbing.createDefault({ env: 'deno' });
```
