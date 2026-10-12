/**
 * ContextBridge — `resume` command
 *
 * Loads the most recent snapshot and displays a summary.
 * Compares current working tree state with the saved state.
 */

import type { Command } from 'commander';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { generateMarkdownHandoff, generateTerminalSummary } from '../../core/handoff.js';
import { compareWithWorkingTree } from '../../core/comparison.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError } from '../../core/errors.js';

interface ResumeOptions {
  id?: string;
  markdown?: boolean;
  json?: boolean;
  compact?: boolean;
}

export function registerResume(program: Command): void {
  program
    .command('resume')
    .description('Load the most recent snapshot and display your task context')
    .option('--id <id>', 'Resume a specific snapshot by ID (default: most recent)')
    .option('--markdown', 'Output full Markdown handoff (suitable for AI paste)')
    .option('--compact', 'Show a compact summary')
    .option('--json', 'Output as JSON')
    .action(async (options: ResumeOptions) => {
      const isJson = options.json ?? false;
      const cwd = process.cwd();

      try {
        const configStore = new ConfigStore(cwd);
        if (!(await configStore.isInitialized())) {
          throw new NotInitializedError(cwd);
        }

        const config = await configStore.read();
        const snapshotDir = configStore.resolveSnapshotDir(config);
        const store = new SnapshotStore(snapshotDir);

        // Load snapshot
        let result;
        if (options.id) {
          result = await store.load(options.id);
        } else {
          result = await store.loadLatest();
          if (!result) {
            if (isJson) {
              outputJson({
                success: false,
                error: 'No snapshots found. Run "contextbridge capture" first.',
              });
            } else {
              out.warn('No snapshots found.');
              out.info('Run "contextbridge capture" to save your first context snapshot.');
            }
            process.exit(0);
          }
        }

        const { snapshot, warnings } = result;

        // Warn about migrations
        if (warnings.length > 0) {
          warnings.forEach((w) => {
            out.warn(w);
          });
        }

        // Compare with current working tree state
        const comparison = compareWithWorkingTree(snapshot, cwd);
        const hasWorkingTreeChanges = comparison.hasChanges;

        if (isJson) {
          outputJson({
            snapshot,
            workingTreeChanged: hasWorkingTreeChanges,
            comparisonWarnings: comparison.warnings,
          });
          return;
        }

        if (options.markdown) {
          // Full markdown handoff
          out.print(generateMarkdownHandoff(snapshot, { includeMetadata: true }));
          return;
        }

        // Terminal summary
        out.header(`Resuming: ${snapshot.task.title}`);
        out.print('');

        if (options.compact) {
          out.print(generateTerminalSummary(snapshot));
        } else {
          // Full terminal display
          out.print(generateTerminalSummary(snapshot));
        }

        // Working tree divergence warning
        if (hasWorkingTreeChanges) {
          out.print('');
          out.warn('⚠️  Current working tree differs from when this snapshot was saved:');
          const changedFields = comparison.git.filter((d) => d.kind === 'changed');
          changedFields.forEach((d) => {
            out.dim(`  ${d.field}: was "${d.before ?? ''}", now "${d.after ?? ''}"`);
          });
          comparison.warnings.forEach((w) => {
            out.dim(`  ${w}`);
          });
          out.print('');
          out.dim('Tip: The information above reflects the SAVED state, not the current state.');
          out.dim('     Run "git status" to see the current working tree.');
        }

        out.print('');
        out.dim(
          `Snapshot ID: ${snapshot.id}  |  Saved: ${new Date(snapshot.createdAt).toLocaleString()}`,
        );
        out.print('');
        out.info('Run "contextbridge export --markdown" to copy a handoff for an AI assistant.');
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
