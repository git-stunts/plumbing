# The Git Plumbing Guide

Welcome to the industrial-grade way of interacting with Git. This guide covers the essential patterns for using `@git-stunts/plumbing` effectively.

## 1. Asynchronous Initialization

As of v3.0, `plumbing` requires asynchronous initialization. This allows the library to perform runtime-specific environment checks and validate your working directory without blocking the event loop.

```javascript
import GitPlumbing from '@git-stunts/plumbing';

// Recommended: High-level repository service
const git = await GitPlumbing.createRepository({ cwd: './path/to/repo' });

// Low-level: Access the raw plumbing instance
const plumbing = await GitPlumbing.createDefault({ cwd: '.' });
```

## 2. Command Execution

The `execute` method is the workhorse of the library. It wraps Git commands with a robust retry policy, telemetry, and memory safety.

```javascript
// A simple command
const sha = await git.revParse({ revision: 'HEAD' });

// Command with stdin input
const blobSha = await git.execute({
  args: ['hash-object', '-w', '--stdin'],
  input: 'The content to hash'
});
```

### Memory Safety & OOM Protection

By default, `execute` limits the returned output to **10MB** to prevent accidental heap exhaustion. You can tune this per call:

```javascript
const largeOutput = await git.execute({
  args: ['cat-file', '-p', largeBlobSha],
  maxBytes: 100 * 1024 * 1024 // Allow up to 100MB
});
```

## 3. Working with Entities

`plumbing` provides lightweight domain entities for core Git concepts. These are not just plain objects; they are validated via **Zod** schemas.

### GitSha

```javascript
import { GitSha } from '@git-stunts/plumbing';

// Validate a SHA-1 hash (throws if invalid)
const sha = GitSha.from('4b825dc642cb6eb9a060e54bf8d69288fbee4904');

if (sha.isEmptyTree()) {
  console.log('This is the root of everything.');
}
```

### GitRef

```javascript
import { GitRef } from '@git-stunts/plumbing';

const branch = GitRef.branch('main'); // refs/heads/main
const tag = GitRef.tag('v1.0.0');      // refs/tags/v1.0.0

console.log(branch.shortName()); // "main"
```

## 4. The Commit Pipeline

One of the most powerful features of `plumbing` is the ability to create full Git commits from raw data without touching the index.

```javascript
const commitSha = await git.createCommitFromFiles({
  branch: 'refs/heads/archive', // Optional: updates this ref automatically
  message: 'Snapshot 2024-05-01',
  files: [
    { path: 'doc.txt', content: 'Archived content' },
    { path: 'assets/logo.png', content: fs.readFileSync('logo.png') }
  ],
  parents: [currentHeadSha],
  author: { name: 'Archiver', email: 'bot@example.com' },
  committer: { name: 'Archiver', email: 'bot@example.com' }
});
```

## 5. Error Handling

`plumbing` uses structured error types to help you diagnose issues precisely.

```javascript
import { GitPlumbingError, InvalidArgumentError } from '@git-stunts/plumbing';

try {
  await git.execute({ args: ['invalid-command'] });
} catch (err) {
  if (err instanceof GitPlumbingError) {
    console.error(`Operation failed: ${err.operation}`);
    console.error(`Status: ${err.details.code}`);
  }
}
```

For more complex scenarios involving custom runtimes or massive data streams, see the [Advanced Guide](./ADVANCED_GUIDE.md).
