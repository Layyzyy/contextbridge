/**
 * ContextBridge — Snapshot Schema v1.0.0
 *
 * Versioned Zod schema for task context snapshots.
 * All future schema changes must increment the schemaVersion field
 * and add a corresponding migration in src/schema/migrations.ts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** ISO-8601 datetime string */
const isoDatetime = z.string().datetime({ offset: true });

/** Snapshot ID: prefix "cbr_" followed by alphanumeric characters */
const snapshotId = z.string().regex(/^cbr_[a-z0-9_-]{12,}$/, 'Invalid snapshot ID format');

/** Item ID within a snapshot: short alphanumeric string */
const itemId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, 'Item ID must be lowercase alphanumeric with hyphens/underscores');

// ---------------------------------------------------------------------------
// Task status enum
// ---------------------------------------------------------------------------

export const TaskStatus = z.enum(['active', 'blocked', 'completed', 'abandoned']);
export type TaskStatus = z.infer<typeof TaskStatus>;

// ---------------------------------------------------------------------------
// Finding verification status enum
// ---------------------------------------------------------------------------

export const VerificationStatus = z.enum(['verified', 'unverified', 'assumption']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

// ---------------------------------------------------------------------------
// Attempt result enum
// ---------------------------------------------------------------------------

export const AttemptResult = z.enum(['succeeded', 'failed', 'unknown']);
export type AttemptResult = z.infer<typeof AttemptResult>;

// ---------------------------------------------------------------------------
// Step priority enum
// ---------------------------------------------------------------------------

export const StepPriority = z.enum(['high', 'medium', 'low']);
export type StepPriority = z.infer<typeof StepPriority>;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const TaskSchema = z.object({
  title: z.string().min(1).max(256),
  objective: z.string().min(1).max(4096),
  status: TaskStatus,
  notes: z.string().max(8192).optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ProjectSchema = z.object({
  name: z.string().max(256).optional(),
  rootPath: z.string().max(4096).optional(),
  language: z.string().max(128).optional(),
  description: z.string().max(1024).optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const GitStateSchema = z.object({
  available: z.boolean(),
  branch: z.string().max(256).optional(),
  commitHash: z.string().max(64).optional(),
  commitMessage: z.string().max(512).optional(),
  isDirty: z.boolean().optional(),
  changedFiles: z.array(z.string().max(4096)).max(500),
  detachedHead: z.boolean().optional(),
  remoteUrl: z.string().max(2048).optional(),
});
export type GitState = z.infer<typeof GitStateSchema>;

export const FindingSchema = z.object({
  id: itemId,
  statement: z.string().min(1).max(4096),
  verificationStatus: VerificationStatus,
  source: z.string().max(1024).optional(),
  observedAt: isoDatetime.optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AttemptSchema = z.object({
  id: itemId,
  description: z.string().min(1).max(4096),
  outcome: z.string().min(1).max(4096),
  result: AttemptResult,
  errorDetails: z.string().max(4096).optional(),
  reference: z.string().max(1024).optional(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const DecisionSchema = z.object({
  id: itemId,
  decision: z.string().min(1).max(2048),
  rationale: z.string().min(1).max(4096),
  madeAt: isoDatetime.optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const OpenQuestionSchema = z.object({
  id: itemId,
  question: z.string().min(1).max(2048),
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const NextStepSchema = z.object({
  id: itemId,
  step: z.string().min(1).max(2048),
  priority: StepPriority.optional(),
});
export type NextStep = z.infer<typeof NextStepSchema>;

export const SourceSchema = z.object({
  path: z.string().min(1).max(4096),
  description: z.string().max(1024).optional(),
  included: z.boolean(),
});
export type Source = z.infer<typeof SourceSchema>;

export const PrivacySchema = z.object({
  excludedPaths: z.array(z.string().max(4096)).max(1000),
  redactedFields: z.array(z.string().max(256)).max(100),
});
export type Privacy = z.infer<typeof PrivacySchema>;

// ---------------------------------------------------------------------------
// Root snapshot schema
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = '1.0.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export const SnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: snapshotId,
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
  task: TaskSchema,
  project: ProjectSchema,
  git: GitStateSchema,
  findings: z.array(FindingSchema).max(200),
  attempts: z.array(AttemptSchema).max(200),
  decisions: z.array(DecisionSchema).max(200),
  openQuestions: z.array(OpenQuestionSchema).max(200),
  nextSteps: z.array(NextStepSchema).max(200),
  sources: z.array(SourceSchema).max(200),
  privacy: PrivacySchema,
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a snapshot, throwing a descriptive error on failure.
 * Used when reading snapshots from disk.
 */
export function parseSnapshot(data: unknown): Snapshot {
  const result = SnapshotSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid snapshot schema:\n${issues}`);
  }
  return result.data;
}

/**
 * Parse a snapshot's schema version from raw data without full validation.
 * Used to route migrations.
 */
export function peekSchemaVersion(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'schemaVersion' in data) {
    const sv = (data as Record<string, unknown>).schemaVersion;
    return typeof sv === 'string' ? sv : undefined;
  }
  return undefined;
}

/**
 * List of all known schema versions.
 * Snapshots with versions not in this list will be rejected with a clear error.
 */
export const KNOWN_SCHEMA_VERSIONS = [SCHEMA_VERSION] as const;
export type KnownSchemaVersion = (typeof KNOWN_SCHEMA_VERSIONS)[number];

export function isKnownSchemaVersion(v: string): boolean {
  return (KNOWN_SCHEMA_VERSIONS as readonly string[]).includes(v);
}
