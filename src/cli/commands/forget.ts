/**
 * ContextBridge — `forget` command
 *
 * Safely deletes a snapshot with confirmation and path validation.
 */

import type { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError, SnapshotNotFoundError } from '../../core/errors.js';

interface ForgetOptions {
  yes?: boolean;
  json?: boolean;
}

export function registerForget(program: Command): void {
  program
    .command('forget <id>')
    .description('Delete a snapshot permanently')
    .option('-y, --yes', 'Skip confirmation prompt (non-interactive mode)')
    .option('--json', 'Output result as JSON')
    .action(async (id: string, options: ForgetOptions) => {
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

        // Load to get title and confirm existence
        const { snapshot } = await store.load(id);

        if (!isJson) {
          out.print('');
          out.warn('About to permanently delete:');
          out.print(`  ID:     ${snapshot.id}`);
          out.print(`  Title:  ${snapshot.task.title}`);
          out.print(`  Status: ${snapshot.task.status}`);
          out.print(`  Saved:  ${new Date(snapshot.createdAt).toLocaleString()}`);
          out.print('');
          out.warn('This action cannot be undone.');
          out.print('');
        }

        const skipConfirm = options.yes ?? isJson;

        if (!skipConfirm && process.stdin.isTTY) {
          const confirmed = await confirm({
            message: `Delete snapshot "${id}"?`,
            default: false,
          });
          if (!confirmed) {
            out.info('Deletion cancelled.');
            process.exit(3);
          }
        }

        const deleted = await store.delete(id);

        if (!deleted) {
          throw new SnapshotNotFoundError(id);
        }

        if (isJson) {
          outputJson({ success: true, id, deleted: true });
        } else {
          out.success(`Snapshot "${id}" deleted.`);
        }
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
