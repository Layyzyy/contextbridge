/**
 * ContextBridge — `show` command
 */

import type { Command } from 'commander';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { generateMarkdownHandoff } from '../../core/handoff.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError } from '../../core/errors.js';

interface ShowOptions {
  json?: boolean;
  markdown?: boolean;
}

export function registerShow(program: Command): void {
  program
    .command('show <id>')
    .description('Display the details of a specific snapshot')
    .option('--json', 'Output as raw JSON')
    .option('--markdown', 'Output as Markdown handoff')
    .action(async (id: string, options: ShowOptions) => {
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

        const { snapshot, warnings } = await store.load(id);

        warnings.forEach((w) => {
          out.warn(w);
        });

        if (isJson) {
          outputJson(snapshot);
          return;
        }

        if (options.markdown) {
          out.print(generateMarkdownHandoff(snapshot, { includeMetadata: true }));
          return;
        }

        // Human-readable display
        out.header(`Snapshot: ${snapshot.task.title}`);
        out.print('');

        out.print(`  ID:      ${snapshot.id}`);
        out.print(`  Status:  ${snapshot.task.status}`);
        out.print(`  Created: ${new Date(snapshot.createdAt).toLocaleString()}`);
        if (snapshot.updatedAt !== snapshot.createdAt) {
          out.print(`  Updated: ${new Date(snapshot.updatedAt).toLocaleString()}`);
        }
        out.print('');

        out.bold('Objective:');
        out.print(`  ${snapshot.task.objective}`);
        out.print('');

        if (snapshot.task.notes) {
          out.bold('Notes:');
          out.print(`  ${snapshot.task.notes}`);
          out.print('');
        }

        if (snapshot.git.available) {
          out.bold('Git State (at capture time):');
          if (snapshot.git.branch) out.print(`  Branch:  ${snapshot.git.branch}`);
          if (snapshot.git.commitHash) {
            out.print(`  Commit:  ${snapshot.git.commitHash.slice(0, 8)}`);
          }
          if (snapshot.git.commitMessage) {
            out.print(`  Message: ${snapshot.git.commitMessage}`);
          }
          out.print(`  Dirty:   ${snapshot.git.isDirty ? 'yes' : 'no'}`);
          out.print('');
        }

        if (snapshot.findings.length > 0) {
          out.bold(`Findings (${snapshot.findings.length}):`);
          snapshot.findings.forEach((f) => {
            const badge = { verified: '[✓]', unverified: '[?]', assumption: '[~]' }[
              f.verificationStatus
            ];
            out.print(`  ${badge} ${f.statement}`);
            if (f.source) out.dim(`      Source: ${f.source}`);
          });
          out.print('');
        }

        if (snapshot.attempts.length > 0) {
          out.bold(`Attempts (${snapshot.attempts.length}):`);
          snapshot.attempts.forEach((a) => {
            const badge = { succeeded: '[✓]', failed: '[✗]', unknown: '[?]' }[a.result];
            out.print(`  ${badge} ${a.description}`);
            out.dim(`      Outcome: ${a.outcome}`);
          });
          out.print('');
        }

        if (snapshot.openQuestions.length > 0) {
          out.bold(`Open Questions (${snapshot.openQuestions.length}):`);
          snapshot.openQuestions.forEach((q) => {
            out.print(`  ? ${q.question}`);
          });
          out.print('');
        }

        if (snapshot.nextSteps.length > 0) {
          out.bold(`Next Steps (${snapshot.nextSteps.length}):`);
          snapshot.nextSteps.forEach((s) => {
            const priority = s.priority ? ` [${s.priority}]` : '';
            out.print(`  → ${s.step}${priority}`);
          });
          out.print('');
        }
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
