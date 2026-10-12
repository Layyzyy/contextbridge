# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-12

### Added
- **Core Snapshot Architecture**:
  - Structured, Zod-validated context schema (`v1.0.0`) tracking task metadata, Git status, findings, attempts, architectural decisions, open questions, next steps, sources, and privacy controls.
  - Unique snapshot ID generation format `cbr_<base36_timestamp>_<hex_random>`.
  - Schema migration runner framework for seamless forward-compatibility across future iterations.
- **Storage & State Engine**:
  - Atomic filesystem write operations with temporary file swapping (`fs.renameSync`) to guarantee disk integrity.
  - Safe snapshot and workspace deletion guards.
  - Configuration management in `.contextbridge/config.json` with user overrides and default settings.
- **Security & Privacy Layer**:
  - Hardened path traversal defense (`isWithinRoot`, null-byte rejection, symlink resolution).
  - Built-in heuristic secret redaction engine for AWS keys, GitHub tokens, Slack tokens, Bearer tokens, private SSH/RSA keys, and sensitive environment keys.
  - Configurable exclusion engine with default ignores (`node_modules`, `.git`, `.env*`, build artifacts, secrets).
- **Adapters**:
  - Safe Git state collector (`git.ts`) utilizing discrete parameter lists and `spawnSync` without shell interpolation.
  - Project detector (`project.ts`) identifying Node.js, Python, Rust, Go, Java, and Ruby environments.
- **Context Synthesis & Intelligence**:
  - Rich Markdown handoff generator (`generateHandoff`) formatting context for immediate ingestion by LLMs and human teammates.
  - Compact prompt generation mode with heuristic token counter for prompt budget management.
  - Snapshot comparison and working-tree divergence engine (`diffSnapshots`, `computeWorkingTreeDivergence`) reporting branch drift, dirty tree shifts, and added/modified files.
- **Full-Featured CLI (`contextbridge`)**:
  - `contextbridge init`: Initialize workspace `.contextbridge` directory and configuration.
  - `contextbridge capture`: Interactive or non-interactive context snapshot capture.
  - `contextbridge list`: List stored snapshots with status, timestamps, and task summaries.
  - `contextbridge show <id>`: Inspect a snapshot in human-readable or structured JSON format.
  - `contextbridge export <id>`: Export a snapshot as formatted Markdown or raw JSON to stdout or disk.
  - `contextbridge resume [id]`: Restore working mental model with task summary and working tree divergence analysis.
  - `contextbridge diff <idA> [idB]`: Compare two snapshots or compare a snapshot against the current working tree.
  - `contextbridge forget <id>`: Securely delete snapshots with interactive confirmation or `--force`.
  - Global flags: `--json`, `--no-color`, `--cwd`, `--version`, `--help`.
- **Public TypeScript Library API**:
  - Clean ESM exports (`captureContext`, `loadSnapshot`, `saveSnapshot`, `listSnapshots`, `deleteSnapshot`, `generateHandoff`, `compareSnapshots`).
  - Full TypeScript declaration files (`.d.ts`) included in package distributions.
- **Automated Testing & CI**:
  - Comprehensive test suites covering schemas, storage, security, adapters, handoff synthesis, snapshot diffing, library API, and end-to-end CLI workflows.
