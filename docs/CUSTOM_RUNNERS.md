# Custom Runners

`@git-stunts/plumbing` is built on a Hexagonal Architecture, which means the core logic is decoupled from the infrastructure that actually executes Git commands. This allows you to provide a custom runner for non-standard environments.

## The CommandRunner Contract

A custom runner is a class that implements a `run` method. This method is the primary port for shell execution.

### The `run` Method

```typescript
async run(options: RunnerOptions): Promise<RunnerResult>
```

#### `RunnerOptions`

The `options` object contains:

- `command`: The binary to execute (always "git" for this library).
- `args`: An array of string arguments.
- `cwd`: The working directory for the process.
- `input`: Optional `string` or `Uint8Array` to be piped to `stdin`.
- `timeout`: Maximum execution time in milliseconds.
- `env`: An object containing environment variable overrides.

#### `RunnerResult`

The method must return a promise that resolves to an object containing:

- `stdoutStream`: A `ReadableStream` (Web API) or `Readable` (Node.js) representing the stdout of the process.
- `exitPromise`: A promise that resolves when the process completes.

The `exitPromise` must resolve to:

```typescript
{
  code: number;      // Exit code (0 for success)
  stderr: string;    // Captured stderr content
  timedOut: boolean; // Whether the process was killed due to timeout
}
```

## Example: Implementing an SSH Runner

If you need to execute Git commands on a remote server via SSH, you can implement a custom runner:

```javascript
import { ShellRunnerFactory } from '@git-stunts/plumbing';
import { Client } from 'ssh2'; // Hypothetical SSH library

class SshRunner {
  async run({ command, args, cwd, input, timeout, env }) {
    const conn = new Client();
    await conn.connect({ /* ... */ });

    // Implementation logic to spawn remote process, 
    // stream stdout, and capture exit code/stderr...
    
    return {
      stdoutStream, // Must be a stream!
      exitPromise: Promise.resolve({ code: 0, stderr: '', timedOut: false })
    };
  }
}

// Register your runner with a unique name
ShellRunnerFactory.register('remote-ssh', SshRunner);

// Use it when creating your plumbing instance
const git = await GitPlumbing.createDefault({ env: 'remote-ssh' });
```

## The Optional CommandSessionRunner Contract

A custom runner may also implement `open()` to support long-lived duplex Git
protocols. This capability is additive: a class with only `run()` remains fully
compatible with one-shot APIs.

```typescript
async open(options: SessionRunnerOptions): Promise<SessionRunnerResult>
```

`SessionRunnerOptions` contains `command`, `args`, `cwd`, and `env` overrides,
plus two session-specific controls:

- `maxStderrBytes`: Maximum stderr bytes retained in the completion record.
- `timeout`: Optional total session lifetime in milliseconds. There is no default.

The result contract is:

```typescript
interface SessionRunnerResult {
  stdoutStream: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  finished: Promise<{
    code: number;
    error?: Error;
    stderr: string;
    signal?: string | null;
    terminated?: boolean;
    timedOut?: boolean;
  }>;
  write(bytes: Uint8Array): Promise<void>;
  closeInput(): Promise<void>;
  terminate(): void;
}
```

`write()` must honor runtime backpressure. `closeInput()` and `terminate()` must
be idempotent. `finished` must settle exactly once after success, timeout,
termination, or early process exit, and stderr collection must stay bounded.
Spawn failures are represented by a completed session with a nonzero code and
an `error`; they do not bypass the `finished` contract.

Registering a class that implements both methods makes both ports available:

```javascript
class SshRunner {
  async run(options) {
    // Return the existing one-shot RunnerResult.
  }

  async open(options) {
    // Return a SessionRunnerResult backed by one remote process.
  }
}

ShellRunnerFactory.register('remote-ssh', SshRunner);
const git = await GitPlumbing.createDefault({
  cwd: '/remote/path',
  env: 'remote-ssh'
});
```

Functional ports can be injected directly as well:

```javascript
const git = new GitPlumbing({
  cwd: '/remote/path',
  runner: runOnce,
  sessionRunner: openSession
});
```

When `runner` is custom and `sessionRunner` is omitted, session methods fail
with `UnsupportedCapabilityError`. Plumbing does not silently mix the custom
one-shot authority with a built-in local process authority.

Session adapters own process and stream mechanics only. They must not add
pooling, cache, retention, lease, or eviction policy; those belong to the
storage layer using the adapter.

## Why Streaming?

The library enforces a streaming-only interface to ensure memory efficiency. Even for small commands, the runner must provide a stream. The `GitStream` wrapper in the core library will handle collecting this stream if a buffered result is needed, providing safety limits to prevent Out-Of-Memory (OOM) errors.
