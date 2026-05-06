# Advanced Plumbing Guide

This guide is for engineers building high-performance, multi-runtime, or distributed Git systems on top of `@git-stunts/plumbing`.

## 1. Unified Streaming Architecture

Unlike many Git libraries that offer a "buffered vs. streaming" choice, `plumbing` infrastructure is **streaming-first**. Every command runner (Node, Bun, Deno) returns a unified `GitStream`.

### Consuming the Stream

The `executeStream` method returns a `GitStream` wrapper that implements the `AsyncIterable` protocol.

```javascript
const stream = await git.executeStream({
  args: ['cat-file', '-p', largeSha]
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
  env: 'ssh-cloud' // Use the registered name
});
```

## 3. Resilience & Retry Policies

Lock contention (`index.lock`) is a common failure mode in concurrent Git operations. `plumbing` includes an `ExecutionOrchestrator` that handles retries with exponential backoff.

```javascript
import { CommandRetryPolicy } from '@git-stunts/plumbing';

const customPolicy = new CommandRetryPolicy({
  maxRetries: 5,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  totalTimeoutMs: 10000
});

await git.execute({
  args: ['update-ref', 'refs/heads/main', newSha],
  retryPolicy: customPolicy
});
```

## 4. Telemetry & Observability

Every command executed through `GitPlumbing` carries a `traceId`. You can use this to correlate logs across distributed systems.

```javascript
const traceId = `request-${Date.now()}`;

await git.execute({
  args: ['rev-parse', 'HEAD'],
  traceId
});

// The traceId is passed into the CommandRunner and is available in 
// GitPlumbingError if the command fails.
```

## 5. Runtime-Specific Nuances

While the API is unified, the underlying adapters optimize for each runtime:

- **Node.js**: Uses `node:child_process` with native stream piping.
- **Bun**: Uses `Bun.spawn` but falls back to Node compatibility mode for certain I/O edge cases to ensure reliability.
- **Deno**: Uses `Deno.Command` with native readable streams.

`plumbing` automatically detects the environment, but you can override it during initialization if needed:

```javascript
const git = await GitPlumbing.createDefault({ env: 'deno' });
```
