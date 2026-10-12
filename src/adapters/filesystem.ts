/**
 * ContextBridge — Filesystem Adapter
 *
 * Atomic filesystem operations for safe snapshot persistence.
 * All writes use a write-to-temp-then-rename strategy to prevent
 * corrupted partial writes from reaching the target file.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StorageError } from '../core/errors.js';

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

/**
 * Write data to a file atomically using a temp-file + rename strategy.
 * If the write or rename fails, the original file is not modified.
 *
 * @param filePath - Absolute path of the target file
 * @param content - String content to write
 * @param mode - File permission mode (default: 0o600, user read/write only)
 */
export async function atomicWriteFile(
  filePath: string,
  content: string,
  mode = 0o600,
): Promise<void> {
  const dir = path.dirname(filePath);

  // Create parent directories
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });

  // Write to a temp file in the same directory (same filesystem = atomic rename)
  const tmpFile = path.join(
    dir,
    `.cb_tmp_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );

  try {
    await fs.promises.writeFile(tmpFile, content, { encoding: 'utf-8', mode });
    await fs.promises.rename(tmpFile, filePath);
  } catch (err) {
    // Clean up temp file if something went wrong
    try {
      await fs.promises.unlink(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
    throw new StorageError(
      `Failed to write file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * Read a file as UTF-8 text.
 * Returns null if the file does not exist.
 */
export async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw new StorageError(
      `Failed to read file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * Check whether a file or directory exists.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it and parents if needed.
 */
export async function ensureDir(dir: string, mode = 0o700): Promise<void> {
  try {
    await fs.promises.mkdir(dir, { recursive: true, mode });
  } catch (err) {
    if (isNodeError(err) && err.code === 'EEXIST') return;
    throw new StorageError(
      `Failed to create directory "${dir}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * List all JSON files in a directory (non-recursive).
 * Returns empty array if the directory does not exist.
 */
export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return [];
    throw new StorageError(
      `Failed to list directory "${dir}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * Safely delete a file by path. Throws if deletion fails unexpectedly.
 * Does nothing if the file does not exist.
 */
export async function safeDeleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') return false;
    throw new StorageError(
      `Failed to delete file "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

/**
 * Create a temporary directory for testing purposes.
 */
export async function createTempDir(prefix = 'cb_test_'): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Recursively remove a directory (for test cleanup).
 */
export async function removeDir(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface NodeError extends Error {
  code: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && 'code' in err;
}
