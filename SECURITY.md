# Security Model

@git-stunts/plumbing is designed with a "security-by-default" mindset, treating the underlying Git binary as a untrusted subsystem. This document outlines the rationale behind our security policies.

## 🛡️ Git as a Subsystem

Unlike typical libraries that "shell out and pray," this library implements a strict boundary between your application and the Git process. Every command is scrutinized before execution.

## 🚫 Prohibited Flags

We explicitly block global flags that can be used to bypass security controls or cause side effects outside of the target repository:

- `--git-dir`: Blocked to ensure the library only operates within the context intended by the `cwd` option. This prevents "escaping" into unauthorized repositories.
- `--work-tree`: Blocked to maintain strict isolation of the object database operations.
- `-c` / `--config`: Blocked globally to prevent runtime configuration overrides that could alter Git's behavior in insecure ways (e.g., changing internal hooks or execution paths).
- `--exec-path`, `--html-path`, etc.: Blocked to prevent leakage of system-specific paths or redirection of binary execution.

## 🏗️ Whitelisted Commands

The library only permits execution of a strictly defined set of "plumbing" commands. Porcelain commands (like `push`, `pull`, or `clone`) are currently omitted to focus on local object database manipulation and to reduce the attack surface.

## 🧼 Environment Policy

By default, Git processes run in a "Clean Environment." We only whitelist variables essential for identity and localization:

- `GIT_AUTHOR_*` & `GIT_COMMITTER_*`: For cryptographic identity.
- `LANG` & `LC_ALL`: To ensure consistent character encoding.
- `PATH`: To locate the Git binary.

Variables like `GIT_CONFIG_PARAMETERS` are explicitly blocked to prevent configuration injection.

## 🌊 OOM & Resource Protection

- **Streaming-First**: All data is handled via streams to prevent memory exhaustion when dealing with large blobs.
- **Max Buffer Limits**: When collecting streams, a default 10MB limit is enforced to protect against Out-Of-Memory (OOM) errors.
- **Concurrency Control**: High-level services (like `GitRepositoryService`) implement internal concurrency limits when spawning multiple Git processes to prevent PID exhaustion.

## 🐞 Reporting a Vulnerability

If you discover a security vulnerability, please send an e-mail to james@flyingrobots.dev.