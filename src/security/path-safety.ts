/**
 * ContextBridge — Path Safety
 *
 * Prevents path traversal attacks and ensures all filesystem operations
 * remain within their intended root directories.
 *
 * Security contract:
 * - All paths passed to storage operations must be validated before use.
 * - Symbolic links are resolved before validation to prevent bypass attacks.
 * - Paths containing null bytes or other control characters are rejected.
 */

import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Path validation errors
// ---------------------------------------------------------------------------

export class PathTraversalError extends Error {
  constructor(
    public readonly attemptedPath: string,
    public readonly rootPath: string,
  ) {
    super(
      `Path traversal detected: "${attemptedPath}" is outside the allowed root "${rootPath}". ` +
        `This may indicate a security issue or misconfiguration.`,
    );
    this.name = 'PathTraversalError';
  }
}

export class InvalidPathError extends Error {
  constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`Invalid path "${path}": ${reason}`);
    this.name = 'InvalidPathError';
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a path string does not contain dangerous characters.
 * Rejects null bytes and control characters that can bypass filters.
 */
export function validatePathString(p: string): void {
  if (p.includes('\0')) {
    throw new InvalidPathError(p, 'contains null byte');
  }
  // Reject strings with control characters (0x00–0x1F)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F]/.test(p)) {
    throw new InvalidPathError(p, 'contains control characters');
  }
  if (p.trim() === '') {
    throw new InvalidPathError(p, 'empty path');
  }
}

/**
 * Resolve a user-supplied path relative to a base directory and verify
 * it stays within that directory (i.e., no path traversal).
 *
 * Uses `path.resolve` which normalizes the path (removes .., etc.) and
 * then checks that the resolved path starts with the root.
 *
 * Does NOT require the path to exist on disk.
 */
export function resolveAndValidate(rootDir: string, userPath: string): string {
  validatePathString(userPath);
  validatePathString(rootDir);

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(rootDir, userPath);

  // Ensure the resolved path is within the root
  if (!isWithinRoot(resolvedPath, resolvedRoot)) {
    throw new PathTraversalError(userPath, resolvedRoot);
  }

  return resolvedPath;
}

/**
 * Check whether a resolved path is within a root directory.
 * Adds a path separator to the root to avoid false positives where
 * the root is a prefix of a sibling directory name.
 */
export function isWithinRoot(resolvedPath: string, resolvedRoot: string): boolean {
  const normPath = path.resolve(resolvedPath);
  const normRoot = path.resolve(resolvedRoot);
  const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
  return normPath === normRoot || normPath.startsWith(rootWithSep);
}

/**
 * Resolve a path, following symlinks, and verify it stays within the root.
 * Use this for paths that may be symlinks.
 *
 * Falls back to non-symlink validation if the path doesn't exist yet.
 */
export function resolveAndValidateReal(rootDir: string, userPath: string): string {
  validatePathString(userPath);
  validatePathString(rootDir);

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(rootDir, userPath);

  // First check without resolving symlinks
  if (!isWithinRoot(resolvedPath, resolvedRoot)) {
    throw new PathTraversalError(userPath, resolvedRoot);
  }

  // If the path exists, also resolve symlinks and re-check
  if (fs.existsSync(resolvedPath)) {
    const realPath = fs.realpathSync(resolvedPath);
    let realRoot = resolvedRoot;
    try {
      realRoot = fs.realpathSync(resolvedRoot);
    } catch {
      // Use resolved root if realpath fails
    }

    if (!isWithinRoot(realPath, realRoot)) {
      throw new PathTraversalError(userPath, realRoot);
    }

    return realPath;
  }

  return resolvedPath;
}

/**
 * Sanitize a filename (not a full path) to be safe for use as a file name.
 * Strips path separators, null bytes, and control characters.
 */
export function sanitizeFilename(name: string): string {
  validatePathString(name);
  // Remove path separators and dots that could cause traversal
  const sanitized = name.replace(/[/\\]/g, '_').replace(/\.\./g, '__').replace(/^\./, '_').trim();

  if (!sanitized) {
    throw new InvalidPathError(name, 'results in empty filename after sanitization');
  }

  return sanitized;
}
