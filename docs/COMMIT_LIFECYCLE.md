# Git Commit Lifecycle Tutorial

This guide walks you through the low-level construction of a Git commit using the `@git-stunts/plumbing` high-level domain entities and services.

## 🧱 1. Constructing GitBlobs

The foundation of every Git repository is the blob (binary large object). Blobs store file content without filenames or metadata.

```javascript
import { GitBlob } from '@git-stunts/plumbing';

// Create blobs from strings or binary data
const readmeBlob = GitBlob.fromContent('# My Project\nHello world!');
const scriptBlob = GitBlob.fromContent('echo "Hello from script"');
```

## 🌲 2. Building the Tree

Trees map filenames to blobs (or other trees) and assign file modes (e.g., regular file, executable, directory). Use `GitTreeBuilder` for a fluent construction experience.

```javascript
import { GitTreeBuilder } from '@git-stunts/plumbing';

// We need a repository service to get SHAs for our blobs
const repo = GitPlumbing.createRepository();

// Write blobs first to get their SHAs
const readmeSha = await repo.save(readmeBlob);
const scriptSha = await repo.save(scriptBlob);

// Build the tree
const tree = new GitTreeBuilder()
  .addEntry({
    path: 'README.md',
    sha: readmeSha,
    mode: '100644'
  })
  .addEntry({
    path: 'run.sh',
    sha: scriptSha,
    mode: '100755' // Executable
  })
  .build();
```

## 📝 3. Creating a GitCommit

A commit object links a tree to a specific point in time, with an author, a committer, a message, and optional parent references.

```javascript
import { GitCommitBuilder, GitSignature, GitSha } from '@git-stunts/plumbing';

// Persist the tree to get its SHA
const treeSha = await repo.save(tree);

// Define identity
const author = new GitSignature({
  name: 'James Ross',
  email: 'james@flyingrobots.dev'
});

// Build the commit
const commit = new GitCommitBuilder()
  .tree(treeSha)
  .message('Feat: initial architecture')
  .author(author)
  .committer(author)
  // .parent('optional-parent-sha')
  .build();
```

## 💾 4. Persisting the Graph

Finally, use `GitRepositoryService.save()` to persist the commit and update a reference (branch) to point to it.

```javascript
// Save the commit object
const commitSha = await repo.save(commit);

// Point the 'main' branch to the new commit
await repo.updateRef({
  ref: 'refs/heads/main',
  newSha: commitSha
});

console.log(`Commit created successfully: ${commitSha}`);
```

## 🚀 Pro Tip: One-Call Orchestration

While building the graph manually offers maximum control, you can use the high-level `commit()` method for common workflows:

```javascript
const finalSha = await git.commit({
  branch: 'refs/heads/main',
  message: 'Docs: update lifecycle guide',
  author: author,
  committer: author,
  parents: [commitSha],
  files: [
    { path: 'docs/GUIDE.md', content: 'New content...' }
  ]
});
```

```