/**
 * ContextBridge — Core Errors
 *
 * Typed error hierarchy for consistent error handling across the library.
 * These errors have user-friendly messages for CLI display and machine-readable
 * codes for programmatic handling.
 */

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

export abstract class ContextBridgeError extends Error {
  abstract readonly code: string;

  override message: string;

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.message = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ---------------------------------------------------------------------------
// Specific error types
// ---------------------------------------------------------------------------

/** Snapshot not found by ID */
export class SnapshotNotFoundError extends ContextBridgeError {
  readonly code = 'SNAPSHOT_NOT_FOUND';

  constructor(public readonly id: string) {
    super(`Snapshot "${id}" was not found. Run "contextbridge list" to see available snapshots.`);
  }
}

/** Snapshot data is malformed or fails schema validation */
export class SnapshotCorruptedError extends ContextBridgeError {
  readonly code = 'SNAPSHOT_CORRUPTED';

  constructor(
    public readonly id: string,
    public readonly path: string,
    cause?: unknown,
  ) {
    super(
      `Snapshot "${id}" at "${path}" is corrupted or does not match the expected schema. ` +
        `The file may have been manually edited or come from an incompatible version.`,
      cause,
    );
  }
}

/** Schema version is not supported by this version of ContextBridge */
export class UnsupportedSchemaVersionError extends ContextBridgeError {
  readonly code = 'UNSUPPORTED_SCHEMA_VERSION';

  constructor(
    public readonly version: string,
    public readonly supportedVersion: string,
  ) {
    super(
      `Snapshot uses schema version "${version}" which is not supported by this version of ContextBridge ` +
        `(supports: "${supportedVersion}"). Please update ContextBridge to read this snapshot.`,
    );
  }
}

/** ContextBridge has not been initialized in this directory */
export class NotInitializedError extends ContextBridgeError {
  readonly code = 'NOT_INITIALIZED';

  constructor(public readonly directory: string) {
    super(
      `ContextBridge has not been initialized in "${directory}". ` +
        `Run "contextbridge init" to set up this directory.`,
    );
  }
}

/** ContextBridge is already initialized in this directory */
export class AlreadyInitializedError extends ContextBridgeError {
  readonly code = 'ALREADY_INITIALIZED';

  constructor(public readonly directory: string) {
    super(
      `ContextBridge is already initialized in "${directory}". ` +
        `Use --force to reinitialize (this will not overwrite existing snapshots).`,
    );
  }
}

/** A file or directory already exists and would be overwritten */
export class FileExistsError extends ContextBridgeError {
  readonly code = 'FILE_EXISTS';

  constructor(
    public readonly path: string,
    hint?: string,
  ) {
    super(
      `"${path}" already exists. ${hint ?? 'Use --force or --output to specify a different path.'}`,
    );
  }
}

/** Configuration is invalid */
export class ConfigurationError extends ContextBridgeError {
  readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string) {
    super(`Configuration error: ${message}`);
  }
}

/** A required operation was cancelled by the user */
export class OperationCancelledError extends ContextBridgeError {
  readonly code = 'OPERATION_CANCELLED';

  constructor() {
    super('Operation cancelled.');
  }
}

/** Git is not available or this is not a git repository */
export class GitNotAvailableError extends ContextBridgeError {
  readonly code = 'GIT_NOT_AVAILABLE';

  constructor(public readonly reason: string) {
    super(`Git information is not available: ${reason}`);
  }
}

/** Storage operation failed */
export class StorageError extends ContextBridgeError {
  readonly code = 'STORAGE_ERROR';

  constructor(message: string, cause?: unknown) {
    super(`Storage error: ${message}`, cause);
  }
}

/** An invalid argument was provided */
export class ValidationError extends ContextBridgeError {
  readonly code = 'VALIDATION_ERROR';
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isContextBridgeError(err: unknown): err is ContextBridgeError {
  return err instanceof ContextBridgeError;
}

/**
 * Format an error for display, including the cause chain if relevant.
 * Never includes a stack trace (that's for debug mode only).
 */
export function formatError(err: unknown): string {
  if (err instanceof ContextBridgeError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
