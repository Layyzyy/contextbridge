/**
 * ContextBridge — Configuration Schema
 *
 * Validated Zod schema for the .contextbridge/config.json file.
 */

import { z } from 'zod';

export const ExportFormat = z.enum(['markdown', 'json']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const RedactionBehavior = z.enum(['reject', 'redact', 'warn']);
export type RedactionBehavior = z.infer<typeof RedactionBehavior>;

export const ConfigSchema = z.object({
  /** Schema version for the config format itself */
  configVersion: z.literal('1.0.0').default('1.0.0'),

  /** Directory where snapshots are stored, relative to project root */
  storageDirectory: z.string().min(1).max(4096).default('.contextbridge/snapshots'),

  /** Default format for the `export` command */
  defaultExportFormat: ExportFormat.default('markdown'),

  /** Additional file/directory glob patterns to exclude from context capture */
  additionalExclusions: z.array(z.string().max(4096)).max(500).default([]),

  /** Maximum size in bytes for user-selected content in a snapshot (default 64KB) */
  maxContentSizeBytes: z
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(65536),

  /** How to handle detected secrets in explicitly selected content */
  redactionBehavior: RedactionBehavior.default('redact'),

  /** Preferred handoff template: 'standard' or a path to a custom template */
  handoffTemplate: z.string().max(4096).default('standard'),

  /**
   * Whether to include git diff metadata (hunk summaries, not full diffs).
   * Full diffs are never stored by default.
   */
  includeGitDiffMetadata: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = {
  configVersion: '1.0.0',
  storageDirectory: '.contextbridge/snapshots',
  defaultExportFormat: 'markdown',
  additionalExclusions: [],
  maxContentSizeBytes: 65536,
  redactionBehavior: 'redact',
  handoffTemplate: 'standard',
  includeGitDiffMetadata: false,
};

/**
 * Parse and validate configuration, throwing a descriptive error on failure.
 */
export function parseConfig(data: unknown): Config {
  const result = ConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return result.data;
}
