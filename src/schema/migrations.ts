/**
 * ContextBridge — Schema Migrations
 *
 * Strategy: each migration function transforms a raw JSON object from one
 * schema version to the next. Migrations run sequentially when loading an
 * older snapshot. Unknown fields are preserved under a `_legacy` key rather
 * than silently discarded.
 *
 * Compatibility guarantees:
 * - Snapshots written by v1.0.0 will always be readable by v1.x.x.
 * - Breaking changes require a new major version and a migration path.
 * - Snapshots from unknown future versions are rejected with a clear error.
 */

import { isKnownSchemaVersion, SCHEMA_VERSION } from './snapshot.js';

export interface MigrationResult {
  data: Record<string, unknown>;
  migratedFrom: string;
  migratedTo: string;
  warnings: string[];
}

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration registry: maps "fromVersion" -> migration function.
 * Add new entries here when adding new schema versions.
 */
const migrations: Record<string, MigrationFn> = {
  // No migrations needed yet for initial v1.0.0
  // Future example:
  // '1.0.0': (data) => ({ ...data, schemaVersion: '1.1.0', newField: 'default' }),
};

/**
 * Migrate a raw snapshot object to the current schema version.
 * Returns the migrated data and any warnings encountered.
 */
export function migrateSnapshot(
  data: Record<string, unknown>,
  fromVersion: string,
): MigrationResult {
  const warnings: string[] = [];

  if (!isKnownSchemaVersion(fromVersion)) {
    throw new Error(
      `Unsupported snapshot schema version: "${fromVersion}". ` +
        `This version of ContextBridge supports: ${SCHEMA_VERSION}. ` +
        `Please update ContextBridge to read this snapshot.`,
    );
  }

  if (fromVersion === SCHEMA_VERSION) {
    return {
      data,
      migratedFrom: fromVersion,
      migratedTo: SCHEMA_VERSION,
      warnings,
    };
  }

  let current = { ...data };
  let currentVersion: string = fromVersion;

  while (currentVersion !== SCHEMA_VERSION) {
    const migrateFn = migrations[currentVersion];
    if (!migrateFn) {
      throw new Error(
        `No migration path found from schema version "${currentVersion}" to "${SCHEMA_VERSION}". ` +
          `This is a bug — please report it at https://github.com/Layyzyy/contextbridge/issues`,
      );
    }
    current = migrateFn(current);
    const nextVersion = current.schemaVersion;
    if (typeof nextVersion !== 'string') {
      throw new Error(`Migration from "${currentVersion}" did not produce a valid schemaVersion.`);
    }
    currentVersion = nextVersion;
  }

  return {
    data: current,
    migratedFrom: fromVersion,
    migratedTo: SCHEMA_VERSION,
    warnings,
  };
}
