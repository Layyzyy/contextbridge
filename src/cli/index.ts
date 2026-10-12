#!/usr/bin/env node
/**
 * ContextBridge CLI — entry point
 *
 * Local-first context management for developers.
 * Run `contextbridge --help` for usage information.
 */

import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerCapture } from './commands/capture.js';
import { registerResume } from './commands/resume.js';
import { registerList } from './commands/list.js';
import { registerShow } from './commands/show.js';
import { registerExport } from './commands/export.js';
import { registerDiff } from './commands/diff.js';
import { registerForget } from './commands/forget.js';

// ---------------------------------------------------------------------------
// Package version (read from package.json)
// ---------------------------------------------------------------------------

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let version = '1.0.0';
try {
  // Walk up from dist/cli/ to find package.json
  const pkgPath = path.resolve(__dirname, '../../package.json');
  const pkg = require(pkgPath) as { version?: string };
  version = pkg.version ?? '1.0.0';
} catch {
  // Fallback if package.json not found (shouldn't happen in production)
}

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('contextbridge')
  .description(
    'Local-first context management for developers.\n' +
      'Capture the state of your work. Preserve what matters. Resume anywhere.',
  )
  .version(version, '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Display help information')
  .addHelpText(
    'after',
    `
Examples:
  $ contextbridge init
  $ contextbridge capture --title "Fix auth bug" --objective "Trace JWT expiry issue"
  $ contextbridge resume
  $ contextbridge list
  $ contextbridge show cbr_abc123
  $ contextbridge export cbr_abc123 --format markdown
  $ contextbridge diff cbr_abc123
  $ contextbridge forget cbr_abc123

Environment variables:
  NO_COLOR               Disable colored output
  CONTEXTBRIDGE_DEBUG=1  Enable debug output (stack traces, verbose logs)

Documentation: https://github.com/Layyzyy/contextbridge
`,
  );

// Register all commands
registerInit(program);
registerCapture(program);
registerResume(program);
registerList(program);
registerShow(program);
registerExport(program);
registerDiff(program);
registerForget(program);

// ---------------------------------------------------------------------------
// Parse and handle top-level errors
// ---------------------------------------------------------------------------

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ERROR] ${message}\n`);
  process.exit(1);
});
