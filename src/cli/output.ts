/**
 * ContextBridge — CLI Output Utilities
 *
 * Consistent terminal output with color support, --no-color handling,
 * and JSON output mode for machine-readable responses.
 */

import chalk from 'chalk';
import { isContextBridgeError, formatError } from '../core/errors.js';

// ---------------------------------------------------------------------------
// Color support detection
// ---------------------------------------------------------------------------

function shouldUseColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  return chalk.level > 0;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

export const out = {
  success(msg: string): void {
    if (shouldUseColor()) {
      process.stdout.write(chalk.green('✓ ') + msg + '\n');
    } else {
      process.stdout.write('[OK] ' + msg + '\n');
    }
  },

  error(msg: string): void {
    if (shouldUseColor()) {
      process.stderr.write(chalk.red('✗ ') + msg + '\n');
    } else {
      process.stderr.write('[ERROR] ' + msg + '\n');
    }
  },

  warn(msg: string): void {
    if (shouldUseColor()) {
      process.stderr.write(chalk.yellow('⚠ ') + msg + '\n');
    } else {
      process.stderr.write('[WARN] ' + msg + '\n');
    }
  },

  info(msg: string): void {
    if (shouldUseColor()) {
      process.stdout.write(chalk.blue('ℹ ') + msg + '\n');
    } else {
      process.stdout.write('[INFO] ' + msg + '\n');
    }
  },

  print(msg: string): void {
    process.stdout.write(msg + '\n');
  },

  dim(msg: string): void {
    if (shouldUseColor()) {
      process.stdout.write(chalk.dim(msg) + '\n');
    } else {
      process.stdout.write(msg + '\n');
    }
  },

  header(msg: string): void {
    if (shouldUseColor()) {
      process.stdout.write('\n' + chalk.bold.cyan(msg) + '\n');
    } else {
      process.stdout.write('\n' + msg.toUpperCase() + '\n');
    }
    process.stdout.write('─'.repeat(Math.min(msg.length + 2, 80)) + '\n');
  },

  bold(msg: string): void {
    if (shouldUseColor()) {
      process.stdout.write(chalk.bold(msg) + '\n');
    } else {
      process.stdout.write(msg + '\n');
    }
  },

  debug(msg: string): void {
    if (process.env.CONTEXTBRIDGE_DEBUG === '1' || process.env.DEBUG === 'contextbridge') {
      process.stderr.write(chalk.dim('[DEBUG] ') + chalk.dim(msg) + '\n');
    }
  },
};

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

export function outputJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export function outputJsonError(code: string, message: string): void {
  process.stderr.write(JSON.stringify({ error: { code, message } }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export function handleCommandError(err: unknown, isJson: boolean): never {
  if (isJson) {
    const code = isContextBridgeError(err) ? err.code : 'UNKNOWN_ERROR';
    const message = formatError(err);
    outputJsonError(code, message);
  } else {
    const message = formatError(err);
    out.error(message);

    if (
      (process.env.CONTEXTBRIDGE_DEBUG === '1' || process.env.DEBUG === 'contextbridge') &&
      err instanceof Error &&
      err.stack
    ) {
      process.stderr.write(chalk.dim(err.stack) + '\n');
    }
  }

  process.exit(1);
}

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

export const ExitCode = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_INPUT: 2,
  OPERATION_CANCELLED: 3,
} as const;
