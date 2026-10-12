/**
 * ContextBridge — `list` command
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError } from '../../core/errors.js';

interface ListOptions {
  status?: string;
  json?: boolean;
}

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List all saved snapshots')
    .option('--status <status>', 'Filter by status: active, blocked, completed, abandoned')
    .option('--json', 'Output as JSON')
    .action(async (options: ListOptions) => {
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

        let summaries = await store.list();

        // Filter by status
        if (options.status) {
          summaries = summaries.filter((s) => s.status === options.status);
        }

        // Sort by createdAt descending (most recent first)
        summaries.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (isJson) {
          outputJson(summaries);
          return;
        }

        if (summaries.length === 0) {
          if (options.status) {
            out.info(`No snapshots found with status "${options.status}".`);
          } else {
            out.info('No snapshots found.');
            out.dim('Run "contextbridge capture" to save your first context snapshot.');
          }
          return;
        }

        out.header(`Snapshots (${summaries.length} found)`);
        out.print('');

        const statusIcon: Record<string, string> = {
          active: chalk.green('●'),
          blocked: chalk.red('●'),
          completed: chalk.gray('✓'),
          abandoned: chalk.gray('✗'),
          unknown: chalk.yellow('?'),
        };

        for (const s of summaries) {
          const icon = statusIcon[s.status] ?? '?';
          const date = s.createdAt
            ? new Date(s.createdAt).toLocaleString('en-US', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : '(unknown date)';

          out.print(`  ${icon} ${chalk.bold(s.id)}`);
          out.print(`     ${s.title}`);
          out.print(`     ${chalk.dim(date)} · ${chalk.dim(s.status)}`);
          out.print('');
        }

        out.dim('Run "contextbridge show <id>" to inspect a snapshot.');
        out.dim('Run "contextbridge resume" to load the most recent snapshot.');
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
