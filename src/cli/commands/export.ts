/**
 * ContextBridge — `export` command
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import { ConfigStore } from '../../storage/config-store.js';
import { SnapshotStore } from '../../storage/snapshot-store.js';
import { generateMarkdownHandoff } from '../../core/handoff.js';
import { out, handleCommandError, outputJson } from '../output.js';
import { NotInitializedError, FileExistsError } from '../../core/errors.js';

interface ExportOptions {
  format?: string;
  output?: string;
  force?: boolean;
  json?: boolean;
}

export function registerExport(program: Command): void {
  program
    .command('export <id>')
    .description('Export a snapshot as Markdown or JSON')
    .option('--format <format>', 'Export format: markdown or json (default: markdown)', 'markdown')
    .option('--output <path>', 'Write to a file instead of stdout')
    .option('--force', 'Overwrite existing output file')
    .option('--json', 'Output metadata as JSON (when writing to file)')
    .action(async (id: string, options: ExportOptions) => {
      const isJson = options.json ?? false;
      const cwd = process.cwd();

      try {
        const configStore = new ConfigStore(cwd);
        if (!(await configStore.isInitialized())) {
          throw new NotInitializedError(cwd);
        }

        const config = await configStore.read();
        const format = options.format ?? config.defaultExportFormat;

        if (format !== 'markdown' && format !== 'json') {
          out.error(`Invalid format: "${format}". Must be "markdown" or "json".`);
          process.exit(2);
        }

        const snapshotDir = configStore.resolveSnapshotDir(config);
        const store = new SnapshotStore(snapshotDir);
        const { snapshot, warnings } = await store.load(id);

        warnings.forEach((w) => {
          out.warn(w);
        });

        // Generate content
        let content: string;
        if (format === 'markdown') {
          content = generateMarkdownHandoff(snapshot, { includeMetadata: true });
        } else {
          content = JSON.stringify(snapshot, null, 2) + '\n';
        }

        // Output
        if (options.output) {
          const outputPath = path.resolve(cwd, options.output);

          // Safety check: reject output paths with traversal
          if (!options.force && fs.existsSync(outputPath)) {
            throw new FileExistsError(outputPath);
          }

          await fs.promises.writeFile(outputPath, content, { encoding: 'utf-8' });

          if (isJson) {
            outputJson({
              success: true,
              id,
              format,
              outputPath,
              size: Buffer.byteLength(content, 'utf-8'),
            });
          } else {
            out.success(`Exported snapshot "${id}" to ${outputPath}`);
            out.dim(`  Format: ${format}, Size: ${Buffer.byteLength(content, 'utf-8')} bytes`);
          }
        } else {
          // Write to stdout
          process.stdout.write(content);
        }
      } catch (err) {
        handleCommandError(err, isJson);
      }
    });
}
