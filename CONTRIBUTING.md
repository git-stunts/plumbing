# Contributing to @git-stunts/plumbing

First off, thank you for considering contributing to this project! It's people like you that make the open-source community such a great place to learn, inspire, and create.

## 📜 Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful and professional in all interactions.

## 🛠️ Development Process

### Prerequisites
- Docker and Docker Compose
- Node.js (for local linting)

### Workflow
1.  **Fork the repository** and create your branch from `main`.
2.  **Install dependencies**: `npm install`.
3.  **Make your changes**: Ensure you follow our architectural principles (SRP, one class per file, no magic values).
4.  **Write tests**: Any new feature or fix *must* include corresponding tests.
5.  **Verify locally**:
    - Run linting: `npm run lint`
    - Run cross-platform tests: `npm test` (requires Docker)
6.  **Commit**: Use [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: ...`, `fix: ...`).
7.  **Submit a Pull Request**: Provide a clear description of the changes and link to any relevant issues.

## 🏗️ Architectural Principles
- **Hexagonal Architecture**: Keep the domain pure. Infrastructure details stay in `adapters`.
- **Value Objects**: Use Value Objects for all domain concepts (SHAs, Refs, Signatures).
- **Security First**: All shell commands must be sanitized via `CommandSanitizer`.
- **Environment Agnostic**: Use `TextEncoder`/`TextDecoder` and avoid runtime-specific APIs in the domain layer.

## 🐞 Reporting Bugs
- Use the GitHub issue tracker.
- Provide a minimal reproducible example.
- Include details about your environment (OS, runtime version).

## 📄 License
By contributing, you agree that your contributions will be licensed under its Apache-2.0 License.
