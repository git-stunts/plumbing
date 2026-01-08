# Git Commit Lifecycle Tutorial

This guide walks you through the low-level construction of a Git commit using the `@git-stunts/plumbing` high-level domain entities and services.

## 🧱 1. Constructing GitBlobs

The foundation of every Git repository is the blob (binary large object). Blobs store file content without filenames or metadata.

```javascript
import { GitBlob } from '@git-stunts/plumbing';

// Create a blob from string content
const blob = GitBlob.fromContent('Hello, Git Plumbing!');

// Or from a Uint8Array
const binaryBlob = GitBlob.fromContent(new Uint8Array([1, 2, 3]));
```

## 🌳 2. Building GitTrees

Trees map filenames to blobs (or other trees) and assign file modes.

```javascript
import { GitTree, GitTreeEntry, GitSha } from '@git-stunts/plumbing';

// Define entries
const entry = new GitTreeEntry({
  path: 'hello.txt',
  sha: GitSha.from('...'), // The SHA returned from persisting the blob
  mode: '100644'
});

// Create the tree
const tree = new GitTree(null, [entry]);
```

## 📝 3. Creating GitCommits

Commits wrap trees with metadata like author, committer, and message.

```javascript
import { GitCommit, GitSignature, GitSha } from '@git-stunts/plumbing';

const author = new GitSignature({
  name: 'James Ross',
  email: 'james@flyingrobots.dev'
});

const commit = new GitCommit({
  sha: null,
  treeSha: GitSha.from('...'), // The SHA returned from persisting the tree
  parents: [], // Empty for root commit
  author,
  committer: author,
  message: 'Feat: my first plumbing commit'
});
```

## 💾 4. Persistence

Use the `GitPersistenceService` to write these objects to the Git object database.

```javascript
import GitPlumbing, { GitPersistenceService } from '@git-stunts/plumbing';

const git = GitPlumbing.createDefault();
const persistence = new GitPersistenceService({ plumbing: git });

// Save objects
const blobSha = await persistence.writeBlob(blob);
const treeSha = await persistence.writeTree(tree);
const commitSha = await persistence.writeCommit(commit);
```

## 🔗 5. Updating References

Finally, point a branch to your new commit.

```javascript
const repo = GitPlumbing.createRepository();
await repo.updateRef({
  ref: 'refs/heads/main',
  newSha: commitSha
});
```
