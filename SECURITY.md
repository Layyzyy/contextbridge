# Security Policy

ContextBridge is committed to ensuring the security, integrity, and privacy of your local development environment and contextual artifacts.

## Reporting a Vulnerability

We take the security of ContextBridge seriously. If you discover a vulnerability or potential security flaw, please do not file a public GitHub issue.

Instead, please report security vulnerabilities by emailing:
**security@contextbridge.dev** (or via GitHub Private Vulnerability Reporting on the repository).

Please include:
- A description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept scripts to reproduce the issue.
- The operating system, Node.js version, and ContextBridge version used.

You can expect an initial acknowledgement within 48 hours and regular status updates until the vulnerability is addressed.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Security Architecture & Threat Model

ContextBridge is intentionally designed with a **local-first, defense-in-depth security model**:

### 1. Zero Cloud Dependency & No Network Exfiltration
ContextBridge core operates 100% locally on your machine.
- It makes **no network requests**, does not connect to external analytics or telemetry endpoints, and does not push context anywhere unless explicitly directed by the user through custom pipe workflows.
- All files, snapshots, and configurations reside under the `.contextbridge/` directory within the local workspace.

### 2. Path Traversal & Filesystem Hardening
All filesystem operations (loading, reading, writing, and deleting) go through strict security guards in `src/security/path-safety.ts`:
- **Root Enclosure**: Every target path is checked using `isWithinRoot(rootPath, targetPath)`. Normalization handles boundary checks (`normPath === normRoot || normPath.startsWith(normRoot + sep)`).
- **Symlink & Realpath Validation**: If a path exists, `fs.realpathSync` resolves symlinks to ensure they do not escape the designated project or snapshot directory.
- **Null-Byte Injection Defense**: Paths containing null bytes (`\0`) are immediately rejected with a typed `PathTraversalError`.
- **Absolute & Relative Path Sanitization**: Disallows upward traversal tricks (`../../`) across all CLI commands and programmatic calls.

### 3. Automatic Secret Detection & Redaction
To prevent accidental exposure of sensitive keys in snapshots or AI handoff prompts, ContextBridge implements pattern-based redaction in `src/security/redaction.ts`:
- **Pattern Matching**: Automatically detects:
  - AWS Access Keys (`AKIA...`)
  - GitHub Personal Access Tokens (`ghp_...`, `gho_...`)
  - GitLab Tokens (`glpat-...`)
  - Slack Tokens (`xox[baprs]-...`)
  - Bearer tokens and Authorization headers
  - Private Keys (`BEGIN RSA PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`, etc.)
  - Generic High-Entropy API keys and passwords
- **Object Tree Sanitization**: Sensitive keys such as `password`, `secret`, `api_key`, `token`, `auth`, `credential`, and `private_key` have their values masked as `[REDACTED]`.
- **Extensible Configuration**: Custom regex patterns and sensitive key names can be supplied in `.contextbridge/config.json`.

### 4. Safe Subprocess Execution
When interacting with the Git VCS in `src/adapters/git.ts`:
- All commands use `child_process.spawnSync` with `shell: false`.
- Arguments are passed as discrete array items, preventing shell injection or command chaining attacks.
- Execution timeout guards prevent hanging child processes.

### 5. Atomic Storage
All state mutations in `src/adapters/filesystem.ts`:
- Snapshots and configurations are written to a temporary sibling file (`.<filename>.<pid>.<ts>.tmp`) before an atomic `fs.renameSync` moves it into place.
- This prevents corrupted, half-written snapshots in case of unexpected termination or disk interrupts.
