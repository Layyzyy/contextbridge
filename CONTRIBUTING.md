# Contributing to ContextBridge

Thank you for your interest in contributing to ContextBridge! This document outlines our development process, guidelines, and instructions for contributing code, documentation, and bug reports.

## Code of Conduct

We are dedicated to providing a welcoming, inclusive, and harassment-free experience for everyone. Please treat all contributors with respect and professionalism.

---

## Local Development Setup

ContextBridge is built with **Node.js (>= 20.0.0)** and **TypeScript 5.x** using native **ECMAScript Modules (ESM)**.

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0
- Git

### 2. Clone and Install
```bash
git clone https://github.com/Layyzyy/contextbridge.git
cd contextbridge
npm install
```

### 3. Build & Watch
```bash
# Compile TypeScript to dist/
npm run build

# Watch mode for iterative development
npm run build:watch
```

### 4. Running Tests
We use [Vitest](https://vitest.dev/) for fast, ESM-native testing.

```bash
# Run test suite once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with code coverage report
npm run test:coverage
```

### 5. Typechecking & Linting
```bash
# Strict TypeScript typecheck across src/ and tests/
npm run typecheck

# ESLint check
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Prettier code formatting check
npm run format:check
```

### 6. Full Pre-publish Validation
Before submitting a pull request, ensure the complete validation pipeline passes cleanly:
```bash
npm run prepublishOnly
```

---

## Architecture Overview

```
src/
├── schema/       # Zod schemas, TypeScript types, and schema migrations
├── core/         # Context assembly, handoff generation, diffing, errors
├── security/     # Path safety, secret redaction, exclusion rules
├── adapters/     # Atomic filesystem I/O, Git subprocesses, project detection
├── storage/      # SnapshotStore and ConfigStore
├── cli/          # Commander CLI entrypoint, commands, and output formatting
└── index.ts      # Public library API
```

---

## Guidelines for Contributions

1. **Local-First & Zero Telemetry**:
   - Do not add network calls or external cloud dependencies to core packages. ContextBridge must remain 100% local-first.
2. **Security & Redaction**:
   - All filesystem operations must pass through `isWithinRoot` and path normalization.
   - Any new text extraction must ensure sensitive keys or credentials are automatically redacted.
3. **Subprocess Execution**:
   - Always use `spawnSync` with `shell: false` and discrete arguments arrays. Never concatenate strings into a shell.
4. **Hermetic & Fast Tests**:
   - Tests must run in isolated temporary directories (`os.tmpdir()`) and clean up after execution.
   - Do not rely on external network connectivity or host Git repository state.
5. **Strict Types**:
   - No `any` types in production code (`src/`). Ensure `npm run typecheck` passes with zero errors.

---

## Pull Request Process

1. Fork the repository and create a feature branch (`git checkout -b feature/my-feature`).
2. Write clean, readable code with descriptive comments and commit messages.
3. Add automated tests covering the new functionality or bug fix.
4. Verify that `npm run prepublishOnly` passes with 0 errors and 0 warnings.
5. Push to your fork and submit a Pull Request describing your changes, motivation, and test verification.
