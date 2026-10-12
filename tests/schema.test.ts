import { describe, it, expect } from 'vitest';
import {
  parseSnapshot,
  peekSchemaVersion,
  isKnownSchemaVersion,
  SCHEMA_VERSION,
  type Snapshot,
} from '../src/schema/snapshot.js';
import { parseConfig, DEFAULT_CONFIG } from '../src/schema/config.js';
import { migrateSnapshot } from '../src/schema/migrations.js';

describe('Schema — Snapshot Validation', () => {
  const validSnapshot: Snapshot = {
    schemaVersion: '1.0.0',
    id: 'cbr_test12345678',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    task: {
      title: 'Implement authentication',
      objective: 'Secure user routes with JWT tokens',
      status: 'active',
      notes: 'Initial progress made',
    },
    project: {
      name: 'auth-service',
      rootPath: '/app',
    },
    git: {
      available: true,
      branch: 'feature/auth',
      commitHash: 'abcdef1234567890abcdef1234567890abcdef12',
      commitMessage: 'Add initial auth controller',
      isDirty: true,
      changedFiles: ['src/auth.ts'],
    },
    findings: [
      {
        id: 'find_1',
        statement: 'JWT secret was missing from environment variables',
        verificationStatus: 'verified',
        source: 'src/config.ts:L12',
      },
    ],
    attempts: [
      {
        id: 'att_1',
        description: 'Tried session cookies instead of JWT',
        outcome: 'Does not support stateless mobile clients',
        result: 'failed',
      },
    ],
    decisions: [
      {
        id: 'dec_1',
        decision: 'Use RS256 asymmetric keys instead of HS256',
        rationale: 'Allows public key verification on satellite services',
      },
    ],
    openQuestions: [
      {
        id: 'q_1',
        question: 'Should token revocation be handled via Redis blacklist?',
      },
    ],
    nextSteps: [
      {
        id: 'step_1',
        step: 'Setup Redis connection pool for token revocation',
        priority: 'high',
      },
    ],
    sources: [],
    privacy: {
      excludedPaths: ['**/*.env*'],
      redactedFields: [],
    },
  };

  it('validates a well-formed snapshot successfully', () => {
    const parsed = parseSnapshot(validSnapshot);
    expect(parsed.id).toBe('cbr_test12345678');
    expect(parsed.task.title).toBe('Implement authentication');
    expect(parsed.task.status).toBe('active');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.attempts).toHaveLength(1);
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.openQuestions).toHaveLength(1);
    expect(parsed.nextSteps).toHaveLength(1);
  });

  it('rejects snapshots missing required fields', () => {
    expect(() => parseSnapshot({})).toThrow(/Invalid snapshot schema/);
    expect(() => parseSnapshot({ ...validSnapshot, id: '' })).toThrow();
    expect(() => parseSnapshot({ ...validSnapshot, task: undefined })).toThrow();
    expect(() => parseSnapshot({ ...validSnapshot, schemaVersion: '0.1.0' })).toThrow();
  });

  it('rejects invalid task statuses', () => {
    const invalidStatus = {
      ...validSnapshot,
      task: { ...validSnapshot.task, status: 'unknown_status' },
    };
    expect(() => parseSnapshot(invalidStatus)).toThrow(/Invalid snapshot schema/);
  });

  it('rejects invalid snapshot IDs', () => {
    const invalidId = {
      ...validSnapshot,
      id: 'invalid-id-without-prefix',
    };
    expect(() => parseSnapshot(invalidId)).toThrow();
  });

  it('correctly peeks schema version without validating entire document', () => {
    expect(peekSchemaVersion({ schemaVersion: '1.0.0', other: 'data' })).toBe('1.0.0');
    expect(peekSchemaVersion({ schemaVersion: 123 })).toBeUndefined();
    expect(peekSchemaVersion(null)).toBeUndefined();
    expect(peekSchemaVersion('not an object')).toBeUndefined();
  });

  it('checks known schema versions', () => {
    expect(isKnownSchemaVersion('1.0.0')).toBe(true);
    expect(isKnownSchemaVersion('99.0.0')).toBe(false);
    expect(isKnownSchemaVersion('')).toBe(false);
  });
});

describe('Schema — Config Validation', () => {
  it('parses valid default config', () => {
    const config = parseConfig(DEFAULT_CONFIG);
    expect(config.storageDirectory).toBe('.contextbridge/snapshots');
    expect(config.defaultExportFormat).toBe('markdown');
    expect(config.additionalExclusions).toEqual([]);
    expect(config.redactionBehavior).toBe('redact');
  });

  it('merges partial config values with defaults', () => {
    const config = parseConfig({
      storageDirectory: 'custom/snapshots',
      defaultExportFormat: 'json',
    });
    expect(config.storageDirectory).toBe('custom/snapshots');
    expect(config.defaultExportFormat).toBe('json');
    expect(config.redactionBehavior).toBe('redact');
  });

  it('rejects invalid config fields', () => {
    expect(() => parseConfig({ defaultExportFormat: 'xml' })).toThrow();
    expect(() => parseConfig({ redactionBehavior: 'invalid' })).toThrow();
  });
});

describe('Schema — Migrations', () => {
  it('returns unchanged data for current schema version', () => {
    const raw = { schemaVersion: SCHEMA_VERSION, test: 'value' };
    const result = migrateSnapshot(raw, SCHEMA_VERSION);
    expect(result.migratedFrom).toBe(SCHEMA_VERSION);
    expect(result.migratedTo).toBe(SCHEMA_VERSION);
    expect(result.data).toEqual(raw);
    expect(result.warnings).toHaveLength(0);
  });

  it('throws for unknown schema version', () => {
    expect(() => migrateSnapshot({ schemaVersion: '999.0.0' }, '999.0.0')).toThrow(
      /Unsupported snapshot schema version/,
    );
  });
});
