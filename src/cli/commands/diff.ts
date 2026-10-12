/**
 * ContextBridge — `diff` command
 */

import type { Command } from 'commander';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import {
  compareSnapshots,
  compareWithWorkingTree,
  formatComparisonReport,
} from '../../core/comparison.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError } from '../../core/errors.js';

interface DiffOptions {
  against?: string;
  tree?: boolean;
  json?: boolean;
}

export function registerDiff(program: Command): void {
  program
    .command('diff <id>')
    .description('Compare a snapshot with the current state or another snapshot')
    .option(
      '--against <id>',
      'Compare with a specific second snapshot (default: compare with working tree)',
    )
    .option('--tree', 'Compare with the current working repository state (default behavior)')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: DiffOptions) => {
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

        const { snapshot: snapshotA, warnings: warningsA } = await store.load(id);
        warningsA.forEach((w) => {
          out.warn(w);
        });

        let result;
        if (options.against) {
          // Snapshot-to-snapshot comparison
          const { snapshot: snapshotB, warnings: warningsB } = await store.load(options.against);
          warningsB.forEach((w) => {
            out.warn(w);
          });
          result = compareSnapshots(snapshotA, snapshotB);
        } else {
          // Snapshot-to-working-tree comparison (default)
          result = compareWithWorkingTree(snapshotA, cwd);
        }

        if (isJson) {
          outputJson(result);
          return;
        }

        out.print(formatComparisonReport(result));
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
