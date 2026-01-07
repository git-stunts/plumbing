# Security Policy

## Supported Versions

Only the latest version of `@git-stunts/plumbing` is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please report it to us by following these steps:

1.  **Do not open a public issue.**
2.  Email your findings to `james@flyingrobots.dev`.
3.  Include a detailed description of the vulnerability, steps to reproduce, and any potential impact.

We will acknowledge receipt of your report within 48 hours and provide a timeline for resolution. We request that you follow coordinated disclosure and refrain from publishing information about the vulnerability until a fix has been released.

### Hardened Scope
This project specifically focuses on preventing:
- **Argument Injection**: Malicious flags passed to Git CLI.
- **Path Traversal**: Unauthorized access outside of the repository's `cwd`.
- **ReDoS**: Regular expression denial of service in validation logic.
