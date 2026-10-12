/**
 * ContextBridge — `capture` command
 *
 * Captures the current task context into a snapshot.
 * Supports interactive and non-interactive modes.
 */

import type { Command } from 'commander';
import { input, select, confirm } from '@inquirer/prompts';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { assembleSnapshot } from '../../core/context.js';
import { generateMarkdownHandoff } from '../../core/handoff.js';
import { parseSnapshot } from '../../schema/snapshot.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError, OperationCancelledError } from '../../core/errors.js';
import type { Task } from '../../schema/snapshot.js';

// ---------------------------------------------------------------------------
// Options interface
// ---------------------------------------------------------------------------

interface CaptureOptions {
  title?: string;
  objective?: string;
  status?: string;
  notes?: string;
  finding: string[];
  attempt: string[];
  question: string[];
  nextStep: string[];
  preview: boolean;
  json?: boolean;
  nonInteractive?: boolean;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerCapture(program: Command): void {
  program
    .command('capture')
    .description('Capture the current task context into a snapshot')
    .option('--title <title>', 'Task title')
    .option('--objective <objective>', 'Task objective or goal')
    .option('--status <status>', 'Task status: active, blocked, completed, abandoned')
    .option('--notes <notes>', 'Developer notes')
    .option('--finding <finding>', 'Add a finding (repeatable)', collectArray, [])
    .option('--attempt <attempt>', 'Add an attempt result (repeatable)', collectArray, [])
    .option('--question <question>', 'Add an open question (repeatable)', collectArray, [])
    .option('--next-step <step>', 'Add a next step (repeatable)', collectArray, [])
    .option('--preview', 'Preview the snapshot before saving (default: true in interactive mode)')
    .option('--no-preview', 'Skip preview')
    .option('--json', 'Output result as JSON (implies --non-interactive)')
    .option('--non-interactive', 'Skip all interactive prompts (requires --title and --objective)')
    .action(async (options: CaptureOptions) => {
      const isJson = options.json ?? false;
      const cwd = process.cwd();

      try {
        const configStore = new ConfigStore(cwd);
        if (!(await configStore.isInitialized())) {
          throw new NotInitializedError(cwd);
        }

        const config = await configStore.read();
        const isNonInteractive = (options.nonInteractive ?? false) || isJson;

        // --------------- Collect inputs ---------------
        let title = options.title;
        let objective = options.objective;
        let status = options.status ?? 'active';
        let notes = options.notes;

        if (!isNonInteractive && process.stdin.isTTY) {
          out.header('Capture Task Context');
          out.print('');
          out.info('Automatically collected: git state, project info, timestamps');
          out.info('Please provide the following information about your task:');
          out.print('');

          title ??= await input({
            message: 'Task title:',
            validate: (v) => v.trim().length > 0 || 'Title is required',
          });

          objective ??= await input({
            message: 'Task objective (what are you trying to accomplish?):',
            validate: (v) => v.trim().length > 0 || 'Objective is required',
          });

          if (!options.status) {
            status = await select({
              message: 'Current status:',
              choices: [
                { name: '🟢 Active — still working on it', value: 'active' },
                { name: '🔴 Blocked — waiting on something', value: 'blocked' },
                { name: '✅ Completed — done!', value: 'completed' },
                { name: '⚫ Abandoned — no longer pursuing', value: 'abandoned' },
              ],
            });
          }

          if (!notes) {
            notes = await input({ message: 'Additional notes (optional, press Enter to skip):' });
            if (!notes.trim()) notes = undefined;
          }
        }

        // Validate required fields
        if (!title?.trim()) {
          if (isJson) {
            outputJson({ success: false, error: 'Missing required field: --title' });
          } else {
            out.error('Missing required field: --title');
            out.dim('Run "contextbridge capture --help" for usage information.');
          }
          process.exit(2);
        }

        if (!objective?.trim()) {
          if (isJson) {
            outputJson({ success: false, error: 'Missing required field: --objective' });
          } else {
            out.error('Missing required field: --objective');
            out.dim('Run "contextbridge capture --help" for usage information.');
          }
          process.exit(2);
        }

        // Validate status
        const validStatuses: Task['status'][] = ['active', 'blocked', 'completed', 'abandoned'];
        if (!validStatuses.includes(status as Task['status'])) {
          const errMsg = `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}`;
          if (isJson) {
            outputJson({ success: false, error: errMsg });
          } else {
            out.error(errMsg);
          }
          process.exit(2);
        }

        // --------------- Assemble snapshot ---------------
        if (!isJson) {
          out.print('');
          out.info('Collecting context...');
        }

        const snapshot = assembleSnapshot({
          cwd,
          title: title.trim(),
          objective: objective.trim(),
          status: status as Task['status'],
          notes: notes && notes.trim() !== '' ? notes.trim() : undefined,
          findings: options.finding.map((f) => ({
            statement: f,
            verificationStatus: 'unverified' as const,
          })),
          attempts: options.attempt.map((a) => ({
            description: a,
            outcome: 'recorded via CLI',
            result: 'unknown' as const,
          })),
          openQuestions: options.question.map((q) => ({
            question: q,
          })),
          nextSteps: options.nextStep.map((s) => ({
            step: s,
          })),
          additionalExclusions: config.additionalExclusions,
        });

        // Validate before previewing
        parseSnapshot(snapshot);

        // --------------- Preview ---------------
        const shouldPreview = options.preview && !isNonInteractive && process.stdin.isTTY;

        if (shouldPreview) {
          out.print('');
          out.header('Preview');
          out.print('');
          out.print(generateMarkdownHandoff(snapshot, { compact: true }));
          out.print('');

          const save = await confirm({ message: 'Save this snapshot?', default: true });

          if (!save) {
            throw new OperationCancelledError();
          }
        }

        // --------------- Save ---------------
        const snapshotDir = configStore.resolveSnapshotDir(config);
        const snapshotStore = new SnapshotStore(snapshotDir);
        const filePath = await snapshotStore.save(snapshot);

        if (isJson) {
          outputJson({
            success: true,
            id: snapshot.id,
            filePath,
            task: snapshot.task,
            git: {
              available: snapshot.git.available,
              branch: snapshot.git.branch,
              commitHash: snapshot.git.commitHash,
              isDirty: snapshot.git.isDirty,
            },
          });
        } else {
          out.print('');
          out.success(`Snapshot saved: ${snapshot.id}`);
          out.dim(`  File: ${filePath}`);
          if (snapshot.git.available) {
            out.dim(`  Branch: ${snapshot.git.branch ?? '(detached HEAD)'}`);
            if (snapshot.git.isDirty) {
              out.dim(`  Working tree: dirty (${snapshot.git.changedFiles.length} changed files)`);
            }
          }
          out.print('');
          out.info('Run "contextbridge resume" to load this context later.');
        }
      } catch (err) {
        if (err instanceof OperationCancelledError) {
          out.warn('Capture cancelled.');
          process.exit(3);
        }
        handleCommandError(err, isJson);
      }
    });
}

function collectArray(value: string, previous: string[]): string[] {
  return [...previous, value];
}
