/**
 * ContextBridge — Public Library API
 *
 * Import individual functions to use ContextBridge programmatically
 * without the CLI. The library API is stable and independently usable.
 *
 * @example
 * ```typescript
 * import { captureContext, loadSnapshot, generateHandoff } from 'contextbridge';
 *
 * // Capture the current task context
 * const snapshot = await captureContext({
 *   title: 'Fix authentication bug',
 *   objective: 'Trace why JWT tokens expire prematurely on mobile clients',
 *   status: 'active',
 *   findings: [{
 *     statement: 'Token TTL is set to 1h but mobile clients disconnect after 30m',
 *     verificationStatus: 'verified',
 *     source: 'auth-service/config.ts:L42',
 *   }],
 * });
 *
 * // Generate a Markdown handoff
 * const markdown = generateHandoff(snapshot);
 * ```
 */

// ---------------------------------------------------------------------------
// Schema types (stable public API)
// ---------------------------------------------------------------------------

export type {
  Snapshot,
  Task,
  TaskStatus,
  GitState,
  Finding,
  VerificationStatus,
  Attempt,
  AttemptResult,
  Decision,
  OpenQuestion,
  NextStep,
  StepPriority,
  Source,
  Privacy,
} from './schema/snapshot.js';

export {
  SCHEMA_VERSION,
  parseSnapshot,
  peekSchemaVersion,
  isKnownSchemaVersion,
} from './schema/snapshot.js';

export type { Config, ExportFormat, RedactionBehavior } from './schema/config.js';
export { DEFAULT_CONFIG, parseConfig } from './schema/config.js';

// ---------------------------------------------------------------------------
// Core errors (public API — consumers may need to catch these)
// ---------------------------------------------------------------------------

export {
  ContextBridgeError,
  SnapshotNotFoundError,
  SnapshotCorruptedError,
  UnsupportedSchemaVersionError,
  NotInitializedError,
  AlreadyInitializedError,
  FileExistsError,
  ConfigurationError,
  OperationCancelledError,
  GitNotAvailableError,
  StorageError,
  ValidationError,
  isContextBridgeError,
  formatError,
} from './core/errors.js';

// ---------------------------------------------------------------------------
// Storage (public API)
// ---------------------------------------------------------------------------

export { SnapshotStore, generateSnapshotId } from './storage/snapshot-store.js';
export type { SnapshotSummary, LoadResult } from './storage/snapshot-store.js';

export { ConfigStore } from './storage/config-store.js';
export type { InitResult } from './storage/config-store.js';

// ---------------------------------------------------------------------------
// Core operations (public API)
// ---------------------------------------------------------------------------

export type { CaptureInput } from './core/context.js';
export { assembleSnapshot } from './core/context.js';

export {
  generateMarkdownHandoff,
  generateTerminalSummary,
  estimateTokenCount,
  estimateTokenCount as estimateTokens,
} from './core/handoff.js';
export type { HandoffOptions } from './core/handoff.js';

export {
  compareSnapshots,
  compareWithWorkingTree,
  formatComparisonReport,
} from './core/comparison.js';
export type { ComparisonResult, FieldDiff, ChangeKind } from './core/comparison.js';

// ---------------------------------------------------------------------------
// Security utilities (public API)
// ---------------------------------------------------------------------------

export {
  DEFAULT_EXCLUSIONS,
  isExcluded,
  filterExcluded,
  buildExclusionPatterns,
} from './security/exclusions.js';
export {
  detectSecrets,
  redactSecrets,
  redactObject,
  REDACTION_MARKER,
} from './security/redaction.js';
export {
  resolveAndValidate,
  isWithinRoot,
  PathTraversalError,
  InvalidPathError,
} from './security/path-safety.js';

// ---------------------------------------------------------------------------
// High-level convenience functions
// ---------------------------------------------------------------------------

import { SnapshotStore, type SnapshotSummary } from './storage/snapshot-store.js';
import { assembleSnapshot, type CaptureInput } from './core/context.js';
import type { Snapshot } from './schema/snapshot.js';
import { generateMarkdownHandoff } from './core/handoff.js';
import type { HandoffOptions } from './core/handoff.js';

/**
 * Capture the current task context into a new snapshot.
 * Automatically collects git and project information from the working directory.
 *
 * @param input - Task information to capture
 * @param storageDir - Directory to save the snapshot in
 * @returns The saved snapshot
 */
export async function captureContext(input: CaptureInput, storageDir: string): Promise<Snapshot> {
  const snapshot = assembleSnapshot(input);
  const store = new SnapshotStore(storageDir);
  await store.save(snapshot);
  return snapshot;
}

/**
 * Load a snapshot by ID from a storage directory.
 *
 * @param id - The snapshot ID (e.g., "cbr_abc123")
 * @param storageDir - The directory where snapshots are stored
 * @returns The snapshot and any migration warnings
 */
export async function loadSnapshot(
  id: string,
  storageDir: string,
): Promise<{ snapshot: Snapshot; warnings: string[] }> {
  const store = new SnapshotStore(storageDir);
  return store.load(id);
}

/**
 * Save a snapshot to a storage directory.
 *
 * @param snapshot - The snapshot to save
 * @param storageDir - Directory to save the snapshot in
 * @returns The file path where the snapshot was saved
 */
export async function saveSnapshot(snapshot: Snapshot, storageDir: string): Promise<string> {
  const store = new SnapshotStore(storageDir);
  return store.save(snapshot);
}

/**
 * Generate a Markdown handoff document from a snapshot.
 *
 * @param snapshot - The snapshot to generate a handoff for
 * @param options - Handoff generation options
 * @returns The Markdown handoff as a string
 */
export function generateHandoff(snapshot: Snapshot, options?: HandoffOptions): string {
  return generateMarkdownHandoff(snapshot, options);
}

/**
 * Generate a compact Markdown prompt representation from a snapshot.
 *
 * @param snapshot - The snapshot to condense
 * @returns Compact prompt string
 */
export function generateCompactPrompt(snapshot: Snapshot): string {
  return generateMarkdownHandoff(snapshot, { compact: true });
}

/**
 * List all snapshots from a storage directory.
 *
 * @param storageDir - Directory where snapshots are stored
 * @returns Array of snapshot summaries
 */
export async function listSnapshots(storageDir: string): Promise<SnapshotSummary[]> {
  const store = new SnapshotStore(storageDir);
  return store.list();
}

/**
 * Delete a snapshot by ID from a storage directory.
 *
 * @param id - The snapshot ID
 * @param storageDir - Directory where snapshots are stored
 * @returns True if deleted, false if not found
 */
export async function deleteSnapshot(id: string, storageDir: string): Promise<boolean> {
  const store = new SnapshotStore(storageDir);
  return store.delete(id);
}
