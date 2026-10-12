/**
 * ContextBridge — `init` command
 */

import type { Command } from 'commander';
import { ConfigStore } from '../../storage/config-store.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { AlreadyInitializedError } from '../../core/errors.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize ContextBridge in the current project directory')
    .option(
      '--force',
      'Reinitialize even if already initialized (does not delete existing snapshots)',
    )
    .option('--json', 'Output result as JSON')
    .action(async (options: { force?: boolean; json?: boolean }) => {
      const isJson = options.json ?? false;
      const cwd = process.cwd();

      try {
        const store = new ConfigStore(cwd);
        const isAlready = await store.isInitialized();

        if (!isJson) {
          out.header('Initializing ContextBridge');

          if (isAlready && !options.force) {
            out.warn('ContextBridge is already initialized in this directory.');
            out.info('Use --force to reinitialize (existing snapshots will not be deleted).');
            process.exit(0);
          }

          out.print('');
          out.print('The following files will be created:');
          out.dim(`  ${cwd}/.contextbridge/config.json   — project configuration`);
          out.dim(`  ${cwd}/.contextbridge/snapshots/     — snapshot storage directory`);
          out.dim(`  ${cwd}/.contextbridge/.gitignore     — prevents accidental snapshot commits`);
          out.print('');
        }

        const result = await store.initialize({ force: options.force });

        if (isJson) {
          outputJson({
            success: true,
            projectRoot: result.projectRoot,
            configPath: result.configPath,
            createdFiles: result.createdFiles,
            wasAlreadyInitialized: result.wasAlreadyInitialized,
          });
        } else {
          if (result.wasAlreadyInitialized && options.force) {
            out.warn('Reinitialized existing ContextBridge configuration.');
          }

          out.success('ContextBridge initialized successfully!');
          out.print('');
          out.print('Created files:');
          result.createdFiles.forEach((f) => {
            out.dim(`  ${f}`);
          });
          out.print('');
          out.info('Next steps:');
          out.print('  1. Run "contextbridge capture" to save your current task context');
          out.print('  2. Run "contextbridge resume" to reload a saved context');
          out.print('  3. Run "contextbridge --help" to see all available commands');
          out.print('');
          out.dim('Tip: Add .contextbridge/snapshots/ to your .gitignore if not using');
          out.dim('     the generated .contextbridge/.gitignore entry.');
        }
      } catch (err) {
        if (err instanceof AlreadyInitializedError && !options.force) {
          if (isJson) {
            outputJson({ success: false, error: err.message, code: err.code });
          } else {
            out.warn(err.message);
          }
          process.exit(0);
        }
        handleCommandError(err, isJson);
      }
    });
}
