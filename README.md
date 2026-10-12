<div align="center">

# ContextBridge 🌉

**Local-first, portable developer context management for engineers and AI coding assistants.**

*Capture the state of your work. Preserve what matters. Resume anywhere.*

[![npm version](https://img.shields.io/npm/v/contextbridge.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/contextbridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![Local-First](https://img.shields.io/badge/architecture-local--first-blueviolet.svg?style=flat-square)](#security--privacy)
[![Zero Network Dependencies](https://img.shields.io/badge/network-zero--exfiltration-success.svg?style=flat-square)](#security--privacy)

</div>

---

## 💡 Why ContextBridge?

Software engineering is an endless battle against context loss:

1. **The Interruption Penalty**: A sudden meeting, critical bug, or context switch wipes out your mental cache. Returning hours later means spending 30+ minutes rediscovering what you were doing.
2. **The AI Handoff Friction**: AI coding tools (Claude, ChatGPT, Gemini, Copilot, Cursor) are only as effective as the context you feed them. Writing manual prompt recaps with your goals, failed attempts, and Git state is repetitive and error-prone.
3. **Branch & PR Amnesia**: Stashing dirty branches or switching feature branches leaves unfinished work orphaned without documentation of decisions, assumptions, and next steps.

**ContextBridge bridges this gap.** It acts as your external developer cache: capturing tasks, findings, experiments, decisions, and repository state into portable, versioned snapshots that can be resumed locally or exported into token-optimized AI prompts with a single command.

---

## ✨ Key Features

- ⚡ **Local-First & Offline**: 100% of your data lives on your machine in `.contextbridge/`. Zero network calls, zero telemetry, zero cloud lock-in.
- 🔒 **Security-Hardened**: Built-in heuristic secret redaction (AWS keys, GitHub tokens, Bearer auth, private keys), strict path-traversal defense, and atomic filesystem writes.
- 🤖 **AI Handoff Ready**: Exports structured, token-optimized Markdown prompts specifically formatted for LLMs with token budget estimates.
- 🔄 **Intelligent Resume**: `contextbridge resume` restores your mental model and detects working tree divergence (branch drift, dirty files, new modifications) since the snapshot was taken.
- 🔍 **Snapshot Diffing**: Compare any two snapshots or diff a snapshot against your current working tree to see how your task evolved.
- 🛠 **Dual Interface**: Use it as an interactive CLI or import the TypeScript SDK directly into your node applications, scripts, or editor extensions.

---

## 📦 Installation

### Global CLI
```bash
npm install -g contextbridge
```

### Local Project Dependency
```bash
npm install -D contextbridge
```

### On-Demand via npx
```bash
npx contextbridge --help
```

---

## 🚀 Quick Start (5 Minutes)

### 1. Initialize your workspace
Run `init` in your repository root to configure `.contextbridge`:
```bash
contextbridge init
```
This creates `.contextbridge/config.json` with sensible defaults and automatically appends `.contextbridge/snapshots/` to your `.gitignore`.

### 2. Capture your current context
Capture your active task and working context. You can run it interactively:
```bash
contextbridge capture
```
Or non-interactively via flags:
```bash
contextbridge capture \
  --title "Refactor Auth Middleware" \
  --objective "Migrate from express-session to stateless JWT cookies" \
  --status active \
  --notes "Completed cookie parsing; need to finish unit tests for expired tokens"
```
ContextBridge automatically records your current branch, commit hash, dirty files, and detected project metadata.

### 3. List and inspect snapshots
```bash
# View all snapshots
contextbridge list

# Inspect a specific snapshot
contextbridge show cbr_m0abc123_def456
```

### 4. Resume your task later
When returning to work after an interruption:
```bash
contextbridge resume
```
ContextBridge displays your objective, past decisions, open questions, and alerts you if your working tree has diverged since the snapshot was taken.

### 5. Export context for an AI Assistant
Generate a clean Markdown prompt ready to paste into Claude, ChatGPT, Gemini, or any LLM:
```bash
# Print Markdown handoff to terminal
contextbridge export cbr_m0abc123_def456

# Or write directly to a file
contextbridge export cbr_m0abc123_def456 --output handoff.md
```

---

## 💻 CLI Command Reference

### `contextbridge init`
Initializes ContextBridge in the current workspace.
```bash
contextbridge init [--path <path>]
```
- `--path <path>`: Custom directory path to initialize (defaults to current directory).

---

### `contextbridge capture`
Captures a new context snapshot of the active workspace.
```bash
contextbridge capture [options]
```
| Option | Description |
| :--- | :--- |
| `-t, --title <title>` | Short title for the active task |
| `-o, --objective <objective>` | Detailed objective or goal of the task |
| `-s, --status <status>` | Task status: `active`, `blocked`, `completed`, or `abandoned` |
| `-n, --notes <notes>` | Additional context notes or thoughts |
| `--non-interactive` | Disable interactive prompts; uses provided flags |

---

### `contextbridge list`
Lists all context snapshots in reverse chronological order.
```bash
contextbridge list [options]
```
| Option | Description |
| :--- | :--- |
| `-l, --limit <n>` | Maximum number of snapshots to display (default: all) |
| `--status <status>` | Filter snapshots by status (`active`, `blocked`, etc.) |
| `--json` | Output snapshot array as raw JSON |

---

### `contextbridge show <id>`
Inspects the full details of a specific snapshot.
```bash
contextbridge show <id> [--json]
```

---

### `contextbridge export <id>`
Exports a snapshot for consumption by LLMs or human collaborators.
```bash
contextbridge export <id> [options]
```
| Option | Description |
| :--- | :--- |
| `-f, --format <format>` | Output format: `markdown` (default) or `json` |
| `-o, --output <file>` | Write output to a file instead of stdout |
| `-c, --compact` | Output compact prompt optimized for smaller token windows |

---

### `contextbridge resume [id]`
Loads the specified snapshot (or the most recent snapshot if omitted) and outputs an actionable resumption summary with divergence analysis.
```bash
contextbridge resume [id]
```

---

### `contextbridge diff <idA> [idB]`
Compares two snapshots or compares a single snapshot against the current working tree.
```bash
# Compare snapshot against current working tree
contextbridge diff cbr_123

# Compare two snapshots
contextbridge diff cbr_123 cbr_456
```

---

### `contextbridge forget <id>`
Deletes a snapshot permanently.
```bash
contextbridge forget <id> [--force]
```
- `-f, --force`: Skip interactive confirmation prompt.

---

### Global Options
- `--json`: Output machine-readable JSON for all CLI commands.
- `--no-color`: Disable colored terminal output (also respects `NO_COLOR` environment variable).
- `--cwd <path>`: Specify the working directory (defaults to `process.cwd()`).
- `-v, --version`: Display ContextBridge version.
- `-h, --help`: Display command help.

---

## 🛠 Programmatic TypeScript SDK

ContextBridge can be used directly as a TypeScript/JavaScript library:

```typescript
import { 
  captureContext, 
  loadSnapshot, 
  listSnapshots, 
  generateHandoff, 
  compareSnapshots 
} from 'contextbridge';

// 1. Capture context programmatically
const snapshot = await captureContext({
  task: {
    title: 'Migrate to Postgres connection pool',
    objective: 'Prevent connection exhaustion under high concurrency',
    status: 'active',
  },
  findings: [
    {
      id: 'f-1',
      statement: 'Default pool size of 10 causes pool timeout on burst requests',
      verificationStatus: 'verified',
    }
  ],
  decisions: [
    {
      id: 'd-1',
      decision: 'Increase max pool size to 50 and add retry logic with jitter',
      rationale: 'Validated under simulated load test with 500 concurrent connections',
    }
  ]
});

console.log(`Captured snapshot: ${snapshot.id}`);

// 2. Generate an AI handoff prompt
const handoffMarkdown = generateHandoff(snapshot);
console.log(handoffMarkdown);

// 3. List existing snapshots
const snapshots = await listSnapshots({ limit: 5 });

// 4. Compare two snapshots
const diff = await compareSnapshots(snapshots[0].id, snapshots[1].id);
console.log(`Files changed: ${diff.filesChanged.length}`);
```

### SDK Export Summary
| Function | Description |
| :--- | :--- |
| `captureContext(options)` | Captures and persists a new context snapshot |
| `loadSnapshot(id, options)` | Loads and validates a snapshot by ID |
| `saveSnapshot(snapshot, options)` | Persists an existing snapshot object atomically |
| `listSnapshots(options)` | Returns all saved snapshots matching query criteria |
| `deleteSnapshot(id, options)` | Deletes a snapshot safely |
| `generateHandoff(snapshot, options)` | Formats a snapshot into AI-ready Markdown |
| `generateCompactPrompt(snapshot)` | Generates a condensed prompt for LLM consumption |
| `estimateTokens(text)` | Estimates token count (approx. 4 chars/token heuristic) |
| `compareSnapshots(idA, idB, options)` | Compares two snapshots or diffs against working tree |
| `computeWorkingTreeDivergence(snap, cwd)` | Computes working tree drift since snapshot creation |

---

## 🔒 Security & Privacy

ContextBridge is engineered with a strict **local-first, defense-in-depth** security model:

1. **Zero Exfiltration**: No telemetry, no remote pings, no cloud dependencies.
2. **Automatic Secret Redaction**: Built-in pattern recognition masks API keys, AWS credentials, GitHub tokens, Slack tokens, Bearer headers, and private SSH/RSA keys before writing to disk or exporting.
3. **Path Traversal Defense**: All file access validates target paths against workspace roots, rejecting null bytes, directory escape tricks (`../`), and symlink escapes.
4. **Subprocess Isolation**: Git integration uses `child_process.spawnSync` with `shell: false` and typed parameter arrays to eliminate shell injection vulnerabilities.
5. **Atomic Disk Writes**: State is written to temporary files and atomically swapped using `fs.renameSync` to eliminate file corruption.

See [SECURITY.md](SECURITY.md) for full details on our threat model and security policies.

---

## ⚙️ Configuration (`.contextbridge/config.json`)

ContextBridge is fully configurable via `.contextbridge/config.json`:

```json
{
  "schemaVersion": "1.0.0",
  "storage": {
    "directory": ".contextbridge/snapshots",
    "retentionDays": 90,
    "maxSnapshots": 100
  },
  "git": {
    "autoDetect": true,
    "includeDiff": false,
    "maxDiffSizeBytes": 524288
  },
  "privacy": {
    "redactSecrets": true,
    "excludedPatterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/.env*",
      "**/dist/**",
      "**/coverage/**"
    ],
    "customSecretPatterns": []
  },
  "ai": {
    "defaultFormat": "markdown",
    "includeAttempts": true,
    "includeFindings": true,
    "includeDecisions": true
  }
}
```

---

## 🧪 Testing & Quality Assurance

ContextBridge maintains a comprehensive test suite using [Vitest](https://vitest.dev/):

```bash
# Run tests
npm test

# Run test coverage
npm run test:coverage

# Strict TypeScript type check
npm run typecheck

# Lint with ESLint
npm run lint
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on local setup, testing standards, and pull request procedures.

---

## 📄 License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 ContextBridge Contributors.
