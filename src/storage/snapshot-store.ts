/**
 * ContextBridge — Snapshot Store
 *
 * CRUD operations for snapshots, with path validation, atomic writes,
 * and schema migration on read.
 */

import path from 'node:path';
import {
  atomicWriteFile,
  readFileOrNull,
  listJsonFiles,
  safeDeleteFile,
  ensureDir,
  pathExists,
} from '../adapters/filesystem.js';
import { parseSnapshot, peekSchemaVersion, type Snapshot } from '../schema/snapshot.js';
import { migrateSnapshot } from '../schema/migrations.js';
import { SnapshotNotFoundError, SnapshotCorruptedError, ValidationError } from '../core/errors.js';
import {
  resolveAndValidateReal,
  isWithinRoot,
  PathTraversalError,
} from '../security/path-safety.js';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';

/**
 * Generate a stable, URL-safe snapshot ID.
 * Format: "cbr_<timestamp>_<random>"
 * Uses crypto.randomBytes for cryptographically secure randomness.
 */
export function generateSnapshotId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `cbr_${timestamp}_${random}`;
}

// ---------------------------------------------------------------------------
// Snapshot store
// ---------------------------------------------------------------------------

export interface SnapshotSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  filePath: string;
}

export interface LoadResult {
  snapshot: Snapshot;
  warnings: string[];
  migratedFrom?: string | undefined;
}

export class SnapshotStore {
  private readonly storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = path.resolve(storageDir);
  }

  get directory(): string {
    return this.storageDir;
  }

  /**
   * Ensure the storage directory exists.
   */
  async ensureExists(): Promise<void> {
    await ensureDir(this.storageDir);
  }

  /**
   * Resolve a snapshot ID to its file path, with path traversal prevention.
   */
  private resolveSnapshotPath(id: string): string {
    // Validate the ID format to prevent injection
    if (!/^cbr_[a-z0-9_-]{12,}$/.test(id)) {
      throw new ValidationError(
        `Invalid snapshot ID: "${id}". IDs must match the format "cbr_<alphanumeric>".`,
      );
    }

    const filename = `${id}.json`;
    try {
      return resolveAndValidateReal(this.storageDir, filename);
    } catch (err) {
      if (err instanceof PathTraversalError) {
        throw new ValidationError(`Snapshot ID "${id}" would escape the storage directory.`);
      }
      throw err;
    }
  }

  /**
   * Save a snapshot to disk atomically.
   * Validates the snapshot before writing.
   */
  async save(snapshot: Snapshot): Promise<string> {
    await this.ensureExists();

    // Validate before writing
    parseSnapshot(snapshot);

    const filePath = this.resolveSnapshotPath(snapshot.id);
    const content = JSON.stringify(snapshot, null, 2) + '\n';
    await atomicWriteFile(filePath, content, 0o600);
    return filePath;
  }

  /**
   * Load a snapshot by ID, applying migrations if needed.
   */
  async load(id: string): Promise<LoadResult> {
    const filePath = this.resolveSnapshotPath(id);

    const raw = await readFileOrNull(filePath);
    if (raw === null) {
      throw new SnapshotNotFoundError(id);
    }

    return this.parseRawSnapshot(raw, id, filePath);
  }

  /**
   * Load the most recently created snapshot.
   */
  async loadLatest(): Promise<LoadResult | null> {
    const summaries = await this.list();
    if (summaries.length === 0) return null;

    // Sort by createdAt descending
    const sorted = [...summaries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const latest = sorted[0];
    if (!latest) return null;

    return this.load(latest.id);
  }

  /**
   * List all snapshots with their summary data.
   * Corrupted snapshots are reported in warnings rather than thrown.
   */
  async list(): Promise<SnapshotSummary[]> {
    const files = await listJsonFiles(this.storageDir);
    const summaries: SnapshotSummary[] = [];

    for (const filePath of files) {
      const basename = path.basename(filePath, '.json');

      // Security: verify the file is within storage dir
      const resolvedFile = path.resolve(filePath);
      if (!isWithinRoot(resolvedFile, this.storageDir)) {
        continue; // Skip files outside storage (shouldn't happen with listJsonFiles)
      }

      const raw = await readFileOrNull(filePath);
      if (!raw) continue;

      try {
        const { snapshot } = this.parseRawSnapshot(raw, basename, filePath);
        summaries.push({
          id: snapshot.id,
          title: snapshot.task.title,
          status: snapshot.task.status,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
          filePath,
        });
      } catch {
        // Include a placeholder for corrupted snapshots
        summaries.push({
          id: basename,
          title: '[Corrupted snapshot]',
          status: 'unknown',
          createdAt: '',
          updatedAt: '',
          filePath,
        });
      }
    }

    return summaries;
  }

  /**
   * Delete a snapshot by ID.
   * Returns false if the snapshot did not exist.
   */
  async delete(id: string): Promise<boolean> {
    const filePath = this.resolveSnapshotPath(id);
    return safeDeleteFile(filePath);
  }

  /**
   * Check whether a snapshot with the given ID exists.
   */
  async exists(id: string): Promise<boolean> {
    try {
      const filePath = this.resolveSnapshotPath(id);
      return await pathExists(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Parse a raw JSON string into a validated Snapshot, applying migrations.
   */
  private parseRawSnapshot(raw: string, id: string, filePath: string): LoadResult {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new SnapshotCorruptedError(id, filePath, new Error('Not valid JSON'));
    }

    // Check schema version and migrate if needed
    const version = peekSchemaVersion(data);
    const warnings: string[] = [];
    let migratedFrom: string | undefined;

    if (!version) {
      throw new SnapshotCorruptedError(id, filePath, new Error('Missing schemaVersion field'));
    }

    let migratedData: unknown = data;
    if (version !== '1.0.0') {
      try {
        const result = migrateSnapshot(data as Record<string, unknown>, version);
        migratedData = result.data;
        migratedFrom = result.migratedFrom;
        warnings.push(...result.warnings);
        if (result.migratedFrom !== result.migratedTo) {
          warnings.push(
            `Snapshot was automatically migrated from schema v${result.migratedFrom} to v${result.migratedTo}.`,
          );
        }
      } catch (err) {
        throw new SnapshotCorruptedError(id, filePath, err);
      }
    }

    try {
      const snapshot = parseSnapshot(migratedData);
      return { snapshot, warnings, migratedFrom };
    } catch (err) {
      throw new SnapshotCorruptedError(id, filePath, err);
    }
  }
}
