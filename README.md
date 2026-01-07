# @git-stunts/plumbing

A robust, class-based wrapper for Git binary execution. Designed for "Git Stunts" applications that bypass the porcelain and interact directly with the object database.

## Features

- **Class-based API**: Encapsulates `cwd` and state.
- **Zero Dependencies**: Uses Node.js standard library.
- **Plumbing First**: Optimized for `commit-tree`, `hash-object`, and `update-ref`.
- **Telemetry**: Error messages include `stdout` and `stderr` for easier debugging.

## Installation

```bash
npm install @git-stunts/plumbing
```

## Usage

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

## API

### `new GitPlumbing({ cwd })`
Creates a new instance tied to a specific directory.

### `execute({ args, input })`
Executes a git command. Throws if the command fails.

### `executeWithStatus({ args })`
Executes a git command and returns `{ stdout, status }`, allowing you to handle non-zero exit codes (like `git diff`) without throwing.

### `emptyTree`
Property returning the well-known SHA-1 of the empty tree.