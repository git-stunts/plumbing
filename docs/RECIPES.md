# Git Plumbing Recipes

This guide provides step-by-step instructions for common low-level Git workflows using `@git-stunts/plumbing`.

## 🏗️ Commit from Scratch

Creating a commit without using high-level porcelain commands (`git add`, `git commit`) involves four primary steps: hashing the content, building the tree, creating the commit object, and updating the reference.

While `GitRepositoryService.createCommitFromFiles` handles this automatically, understanding the underlying plumbing is essential for complex graph manipulations.

### 1. Hash the Content (Blob)
First, turn your files into Git blobs. Use the `GitPersistenceService` or raw execution.

```javascript
import GitPlumbing, { GitBlob, GitSha } from '@git-stunts/plumbing';

const git = GitPlumbing.createDefault();
const repo = GitPlumbing.createRepository({ plumbing: git });

// High-level way:
const blobSha = await repo.writeBlob(GitBlob.fromContent('Hello, Git!'));

// Low-level way:
const shaStr = await git.execute({
  args: ['hash-object', '-w', '--stdin'],
  input: 'Hello, Git!'
});
const lowLevelSha = GitSha.from(shaStr.trim());
```

### 2. Build the Tree
Create a tree object that maps filenames to the blobs created in step 1.

```javascript
import { GitTree, GitTreeEntry } from '@git-stunts/plumbing';

const entry = new GitTreeEntry({ 
  path: 'hello.txt', 
  sha: blobSha, 
  mode: '100644' 
});

const tree = new GitTree(null, [entry]);
const treeSha = await repo.writeTree(tree);
```

### 3. Create the Commit
Create a commit object that points to your tree.

```javascript
import { GitCommit, GitSignature } from '@git-stunts/plumbing';

const sig = new GitSignature({ name: 'James', email: 'james@test.com' });

const commit = new GitCommit({
  sha: null,
  treeSha,
  parents: [], // Root commit
  author: sig,
  committer: sig,
  message: 'Initial plumbing commit'
});

const commitSha = await repo.writeCommit(commit);
```

### 4. Update the Reference
Point your branch (e.g., `main`) to the new commit.

```javascript
await repo.updateRef({ ref: 'refs/heads/main', newSha: commitSha });
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
  initialDelayMs: 200,
  totalTimeout: 5000 // 5 seconds max for the whole operation
});

try {
  await git.execute({
    args: ['update-ref', 'refs/heads/main', newSha],
    retryPolicy: policy
  });
} catch (err) {
  if (err.name === 'GitRepositoryLockedError') {
    console.error('Repository is locked. Remediation: ' + err.details.remediation);
  }
}
```
