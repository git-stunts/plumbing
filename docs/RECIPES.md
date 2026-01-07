# Git Plumbing Recipes

This guide provides step-by-step instructions for common low-level Git workflows using `@git-stunts/plumbing`.

## 🏗️ Commit from Scratch

Creating a commit without using high-level porcelain commands (`git add`, `git commit`) involves four primary steps: hashing the content, building the tree, creating the commit object, and updating the reference.

### 1. Hash the Content (Blob)
First, turn your files into Git blobs.

```javascript
import GitPlumbing from '@git-stunts/plumbing';

const git = GitPlumbing.createDefault();

// Write a file to the object database
const blobSha = await git.execute({
  args: ['hash-object', '-w', '--stdin'],
  input: 'Hello, Git Plumbing!'
});
```

### 2. Build the Tree
Create a tree object that maps filenames to the blobs created in step 1.

```javascript
// mktree expects a specific format: <mode> <type> <sha>\t<file>
const treeInput = `100644 blob ${blobSha}\thello.txt\n`;

const treeSha = await git.execute({
  args: ['mktree'],
  input: treeInput
});
```

### 3. Create the Commit
Create a commit object that points to your tree.

```javascript
const commitSha = await git.execute({
  args: ['commit-tree', treeSha, '-m', 'Initial commit from scratch']
});
```

### 4. Update the Reference
Point your branch (e.g., `main`) to the new commit.

```javascript
await git.execute({
  args: ['update-ref', 'refs/heads/main', commitSha]
});
```

---

## 🌊 Streaming Large Blobs

For large files, avoid buffering the entire content into memory by using the streaming API.

```javascript
const stream = await git.executeStream({
  args: ['cat-file', '-p', 'HEAD:large-asset.bin']
});

// Process chunks as they arrive
for await (const chunk of stream) {
  // chunk is a Uint8Array
  doSomethingWithChunk(chunk);
}
```

## 🛠️ Handling Repository Locks

If a command fails because the repository is locked, use a custom retry policy.

```javascript
import { CommandRetryPolicy } from '@git-stunts/plumbing';

const policy = new CommandRetryPolicy({
  maxAttempts: 5,
  initialDelayMs: 200
});

try {
  await git.execute({
    args: ['update-ref', 'refs/heads/main', newSha],
    retryPolicy: policy
  });
} catch (err) {
  if (err.name === 'GitRepositoryLockedError') {
    console.error(err.details.remediation);
  }
}
```

```