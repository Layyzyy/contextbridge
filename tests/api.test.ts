import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  captureContext,
  loadSnapshot,
  listSnapshots,
  deleteSnapshot,
  generateHandoff,
  compareSnapshots,
  DEFAULT_CONFIG,
  SCHEMA_VERSION,
} from '../src/index.js';

describe('Public API — Programmatic Usage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-api-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('exports SCHEMA_VERSION and DEFAULT_CONFIG', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
    expect(DEFAULT_CONFIG.defaultExportFormat).toBe('markdown');
  });

  it('captures, loads, lists, generates handoff, and deletes snapshot programmatically', async () => {
    // 1. Capture context
    const snapshot = await captureContext(
      {
        cwd: process.cwd(),
        title: 'Programmatic API test task',
        objective: 'Validate contextbridge library without CLI',
        status: 'active',
        notes: 'Testing end to end flow',
        findings: [
          {
            statement: 'Library API is self-contained and clean',
            verificationStatus: 'verified',
          },
        ],
      },
      tempDir,
    );

    expect(snapshot.id).toMatch(/^cbr_/);
    expect(snapshot.task.title).toBe('Programmatic API test task');

    // 2. Load snapshot
    const loaded = await loadSnapshot(snapshot.id, tempDir);
    expect(loaded.snapshot.id).toBe(snapshot.id);
    expect(loaded.snapshot.task.objective).toBe('Validate contextbridge library without CLI');
    expect(loaded.warnings).toEqual([]);

    // 3. List snapshots
    const list = await listSnapshots(tempDir);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(snapshot.id);
    expect(list[0]?.title).toBe('Programmatic API test task');

    // 4. Generate handoff
    const handoff = generateHandoff(loaded.snapshot);
    expect(handoff).toContain('# ContextBridge Handoff: Programmatic API test task');
    expect(handoff).toContain('Library API is self-contained and clean');

    // 5. Compare snapshots
    const diff = compareSnapshots(snapshot, loaded.snapshot);
    expect(diff.hasChanges).toBe(false);

    // 6. Delete snapshot
    const deleted = await deleteSnapshot(snapshot.id, tempDir);
    expect(deleted).toBe(true);

    const afterDelete = await listSnapshots(tempDir);
    expect(afterDelete).toHaveLength(0);
  });
});
