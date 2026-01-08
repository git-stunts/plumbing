# Custom Runners

@git-stunts/plumbing is built on a Hexagonal Architecture, which means the core logic is decoupled from the infrastructure that actually executes the Git commands. This allows you to provide your own "Runner" to execute Git in non-standard environments.

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
const git = GitPlumbing.createDefault({ env: 'remote-ssh' });
```

## Why Streaming?

The library enforces a streaming-only interface to ensure memory efficiency. Even for small commands, the runner must provide a stream. The `GitStream` wrapper in the core library will handle collecting this stream if a buffered result is needed, providing safety limits to prevent Out-Of-Memory (OOM) errors.
