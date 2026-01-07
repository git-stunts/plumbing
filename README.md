# @git-stunts/plumbing

A robust, class-based wrapper for Git binary execution built with strict hexagonal architecture. Designed for "Git Stunts" applications that bypass the porcelain and interact directly with the object database. Supports multiple JavaScript runtimes: Node.js, Bun, and Deno.

## Features

- **Hexagonal Architecture**: Clean separation between domain logic and infrastructure concerns
- **Multi-Platform Support**: Automatically detects and works with Node.js, Bun, and Deno
- **Zero Dependencies**: Uses only standard library APIs from your chosen runtime
- **Plumbing First**: Optimized for `commit-tree`, `hash-object`, and `update-ref`
- **Telemetry**: Error messages include `stdout` and `stderr` for easier debugging
- **Extensible**: Easy to add support for new platforms or custom adapters

## Installation

```bash
npm install @git-stunts/plumbing
```

## Usage

### Basic Usage (Auto-detect platform)

```javascript
import GitPlumbing from '@git-stunts/plumbing';

const git = new GitPlumbing({ cwd: './my-repo' });

// Create a blob
const blobOid = git.execute({ 
  args: ['hash-object', '-w', '--stdin'], 
  input: 'Hello world' 
});

// Create a commit pointing to the empty tree
const commitSha = git.execute({
  args: ['commit-tree', git.emptyTree, '-m', 'Stunt #1'],
});

// Update a ref
git.updateRef({ 
  ref: 'refs/_blog/stunt', 
  newSha: commitSha 
});
```

### Explicit Platform Selection

```javascript
import GitPlumbing from '@git-stunts/plumbing';

// Force Node.js adapter
const gitNode = new GitPlumbing({ 
  cwd: './my-repo', 
  platform: 'node' 
});

// Force Bun adapter  
const gitBun = new GitPlumbing({ 
  cwd: './my-repo', 
  platform: 'bun' 
});

// Force Deno adapter
const gitDeno = new GitPlumbing({ 
  cwd: './my-repo', 
  platform: 'deno' 
});
```

### Custom Adapter Injection

```javascript
import GitPlumbing from '@git-stunts/plumbing';
import { NodeAdapter } from '@git-stunts/plumbing/adapters/node';

const git = new GitPlumbing({ 
  cwd: './my-repo', 
  adapter: NodeAdapter 
});
```

## Architecture

### Hexagonal Layers

```
┌─────────────────────────────────────────┐
│             Application Layer           │  (Entry points, CLI, API)
├─────────────────────────────────────────┤
│            Use Cases Layer              │  (Orchestrators, Commands)
├─────────────────────────────────────────┤
│           Domain Layer                  │  (Core business logic)
├─────────────────────────────────────────┤
│    Ports (Interfaces)                   │  (Abstract contracts)
├─────────────────────────────────────────┤
│           Infrastructure Layer          │  (Platform-specific adapters)
└─────────────────────────────────────────┘
```

### Domain Core

- **GitRepository**: Encapsulates Git repository operations
- **GitCommand**: Represents Git commands with validation
- **GitSha**: SHA-1 hash value object with validation
- **GitRef**: Git reference value object with validation

### Platform Adapters

- **NodeAdapter**: Uses `child_process.execFile` and Node.js APIs
- **BunAdapter**: Uses `Bun.spawn` or `Bun.run` APIs  
- **DenoAdapter**: Uses `Deno.run` or `Deno.spawn` APIs

## API

### `new GitPlumbing({ cwd, platform?, adapter? })`
Creates a new instance tied to a specific directory.

**Parameters:**
- `cwd` (string): Working directory for git operations
- `platform` (string, optional): Target platform (`'node'`, `'bun'`, `'deno'`, `'auto'`)
- `adapter` (object, optional): Custom platform adapter implementation

### `execute({ args, input })`
Executes a git command. Throws if the command fails.

**Parameters:**
- `args` (string[]): Array of git arguments
- `input` (string|Buffer, optional): Stdin input for the command

**Returns:** `Promise<string>` - Trimmed stdout output

### `executeWithStatus({ args })`
Executes a git command and returns `{ stdout, status }`, allowing you to handle non-zero exit codes (like `git diff`) without throwing.

**Parameters:**
- `args` (string[]): Array of git arguments

**Returns:** `Promise<{stdout: string, status: number}>`

### `emptyTree`
Property returning the well-known SHA-1 of the empty tree: `4b825dc642cb6eb9a060e54bf8d69288fbee4904`

### Additional Methods

- `revParse({ revision })`: Resolves a revision to a full SHA
- `updateRef({ ref, newSha, oldSha? })`: Updates a reference to point to a new SHA
- `deleteRef({ ref })`: Deletes a reference

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Node.js  | ✅ Stable | Uses `child_process.execFile` |
| Bun      | ✅ Stable | Uses `Bun.spawn` API |
| Deno     | ✅ Stable | Uses `Deno.run` API |

## Testing

The library includes comprehensive tests across all supported platforms:

```bash
# Run all tests
npm test

# Run tests for specific platform
npm run test:node
npm run test:bun  
npm run test:deno
```

## Contributing

When adding support for new platforms:

1. Implement the `PlatformPort` interface
2. Create platform-specific adapter in `/src/infrastructure/adapters/{platform}/`
3. Add platform detection logic to `PlatformAdapterFactory`
4. Add tests for the new platform
5. Update documentation

## Migration Guide

### From v1.x

The API remains backward compatible. Your existing code will continue to work:

```javascript
// This continues to work unchanged
import GitPlumbing from '@git-stunts/plumbing';
const git = new GitPlumbing({ cwd: './repo' });
```

### Enhanced Usage

Take advantage of the new hexagonal architecture:

```javascript
// Explicit platform selection for better performance
const git = new GitPlumbing({ 
  cwd: './repo', 
  platform: 'bun' // Use Bun if available for faster execution
});

// Custom adapter for specialized environments
const git = new GitPlumbing({ 
  cwd: './repo', 
  adapter: CustomGitAdapter 
});
```