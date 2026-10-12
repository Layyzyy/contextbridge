import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SnapshotStore, generateSnapshotId } from '../src/storage/snapshot-store.js';
import { ConfigStore } from '../src/storage/config-store.js';
import {
  atomicWriteFile,
  safeDeleteFile,
  readFileOrNull,
  pathExists,
} from '../src/adapters/filesystem.js';
import {
  SnapshotNotFoundError,
  SnapshotCorruptedError,
  ValidationError,
} from '../src/core/errors.js';
import type { Snapshot } from '../src/schema/snapshot.js';

describe('Storage — Filesystem Operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-fs-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('performs atomic writes correctly', async () => {
    const targetFile = path.join(tempDir, 'sub', 'test.txt');
    await atomicWriteFile(targetFile, 'Hello World');

    const content = await readFileOrNull(targetFile);
    expect(content).toBe('Hello World');
  });

  it('safely deletes files', async () => {
    const targetFile = path.join(tempDir, 'to-delete.txt');
    await atomicWriteFile(targetFile, 'temporary');

    expect(await pathExists(targetFile)).toBe(true);
    const deleted = await safeDeleteFile(targetFile);
    expect(deleted).toBe(true);
    expect(await pathExists(targetFile)).toBe(false);

    // Deleting nonexistent file returns false without throwing
    const deletedAgain = await safeDeleteFile(targetFile);
    expect(deletedAgain).toBe(false);
  });
});

describe('Storage — SnapshotStore', () => {
  let tempDir: string;
  let store: SnapshotStore;

  const mockSnapshot: Snapshot = {
    schemaVersion: '1.0.0',
    id: 'cbr_123456789012',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    task: {
      title: 'Fix edge-case bug',
      objective: 'Ensure zero-byte files are handled gracefully',
      status: 'active',
    },
    project: {
      name: 'test-project',
      rootPath: '/test',
    },
    git: {
      available: true,
      branch: 'main',
      changedFiles: [],
    },
    findings: [],
    attempts: [],
    decisions: [],
    openQuestions: [],
    nextSteps: [],
    sources: [],
    privacy: {
      excludedPaths: [],
      redactedFields: [],
    },
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-store-'));
    store = new SnapshotStore(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('generates IDs with the cbr_ prefix', () => {
    const id = generateSnapshotId();
    expect(id).toMatch(/^cbr_[a-z0-9_-]+$/);
  });

  it('saves and loads a snapshot', async () => {
    const savedPath = await store.save(mockSnapshot);
    expect(savedPath).toBe(path.join(tempDir, `${mockSnapshot.id}.json`));
    expect(await store.exists(mockSnapshot.id)).toBe(true);

    const result = await store.load(mockSnapshot.id);
    expect(result.snapshot.id).toBe(mockSnapshot.id);
    expect(result.snapshot.task.title).toBe(mockSnapshot.task.title);
  });

  it('throws SnapshotNotFoundError when snapshot does not exist', async () => {
    await expect(store.load('cbr_nonexistent123')).rejects.toThrow(SnapshotNotFoundError);
  });

  it('rejects path traversal attempts in snapshot IDs', async () => {
    await expect(store.load('../../../etc/passwd')).rejects.toThrow(ValidationError);
    await expect(store.exists('../escape')).resolves.toBe(false);
  });

  it('detects and throws SnapshotCorruptedError for malformed JSON', async () => {
    const corruptedId = 'cbr_corrupted123';
    const filePath = path.join(tempDir, `${corruptedId}.json`);
    await fs.writeFile(filePath, 'this is not valid json {{{');

    await expect(store.load(corruptedId)).rejects.toThrow(SnapshotCorruptedError);
  });

  it('lists snapshots and ignores corrupted files in summary listing', async () => {
    await store.save(mockSnapshot);

    const secondSnapshot: Snapshot = {
      ...mockSnapshot,
      id: 'cbr_second999999',
      task: { ...mockSnapshot.task, title: 'Second task' },
    };
    await store.save(secondSnapshot);

    // Write a corrupted file
    await fs.writeFile(path.join(tempDir, 'cbr_badfile123.json'), '{ broken');

    const list = await store.list();
    expect(list).toHaveLength(3);
    expect(list.map((s) => s.id)).toContain(mockSnapshot.id);
    expect(list.map((s) => s.id)).toContain(secondSnapshot.id);
    const corrupted = list.find((s) => s.id === 'cbr_badfile123');
    expect(corrupted?.title).toBe('[Corrupted snapshot]');
  });

  it('loads the latest snapshot accurately', async () => {
    const older: Snapshot = {
      ...mockSnapshot,
      id: 'cbr_older11111111',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
    };
    const newer: Snapshot = {
      ...mockSnapshot,
      id: 'cbr_newer22222222',
      createdAt: new Date('2026-01-02T10:00:00Z').toISOString(),
    };

    await store.save(older);
    await store.save(newer);

    const latest = await store.loadLatest();
    expect(latest).not.toBeNull();
    expect(latest?.snapshot.id).toBe('cbr_newer22222222');
  });

  it('deletes a snapshot', async () => {
    await store.save(mockSnapshot);
    expect(await store.exists(mockSnapshot.id)).toBe(true);

    const deleted = await store.delete(mockSnapshot.id);
    expect(deleted).toBe(true);
    expect(await store.exists(mockSnapshot.id)).toBe(false);
  });
});

describe('Storage — ConfigStore', () => {
  let tempDir: string;
  let configStore: ConfigStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-cfg-'));
    configStore = new ConfigStore(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('initializes config directory, file, and gitignore', async () => {
    expect(await configStore.isInitialized()).toBe(false);

    await configStore.initialize();
    expect(await configStore.isInitialized()).toBe(true);

    const config = await configStore.read();
    expect(config.storageDirectory).toBe('.contextbridge/snapshots');

    const gitignoreExists = await pathExists(path.join(tempDir, '.contextbridge', '.gitignore'));
    expect(gitignoreExists).toBe(true);
  });

  it('updates and persists configuration changes', async () => {
    await configStore.initialize();
    await configStore.update({
      defaultExportFormat: 'json',
      additionalExclusions: ['custom-secret.txt'],
    });

    const updated = await configStore.read();
    expect(updated.defaultExportFormat).toBe('json');
    expect(updated.additionalExclusions).toContain('custom-secret.txt');
  });
});
