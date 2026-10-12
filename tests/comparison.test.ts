import { describe, it, expect } from 'vitest';
import {
  compareSnapshots,
  compareWithWorkingTree,
  formatComparisonReport,
} from '../src/core/comparison.js';
import type { Snapshot } from '../src/schema/snapshot.js';

describe('Comparison — Snapshot Comparison', () => {
  const baseSnapshot: Snapshot = {
    schemaVersion: '1.0.0',
    id: 'cbr_diff11111111',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
    task: {
      title: 'Original Title',
      objective: 'Original Objective',
      status: 'active',
      notes: 'Initial note',
    },
    project: {
      name: 'diff-project',
      rootPath: '/app',
    },
    git: {
      available: true,
      branch: 'main',
      commitHash: '1111111111111111111111111111111111111111',
      commitMessage: 'First commit',
      isDirty: false,
      changedFiles: [],
    },
    findings: [
      {
        id: 'f1',
        statement: 'Finding 1',
        verificationStatus: 'verified',
      },
    ],
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

  it('detects no changes when snapshots are identical in content', () => {
    const result = compareSnapshots(baseSnapshot, { ...baseSnapshot, id: 'cbr_diff22222222' });
    expect(result.hasChanges).toBe(false);
  });

  it('detects task status and title changes', () => {
    const updated: Snapshot = {
      ...baseSnapshot,
      id: 'cbr_diff33333333',
      task: {
        ...baseSnapshot.task,
        title: 'New Title',
        status: 'completed',
      },
    };

    const result = compareSnapshots(baseSnapshot, updated);
    expect(result.hasChanges).toBe(true);
    const titleDiff = result.task.find((d) => d.field === 'title');
    expect(titleDiff?.kind).toBe('changed');
    expect(titleDiff?.before).toBe('Original Title');
    expect(titleDiff?.after).toBe('New Title');

    const statusDiff = result.task.find((d) => d.field === 'status');
    expect(statusDiff?.kind).toBe('changed');
    expect(statusDiff?.before).toBe('active');
    expect(statusDiff?.after).toBe('completed');
  });

  it('detects added findings', () => {
    const updated: Snapshot = {
      ...baseSnapshot,
      id: 'cbr_diff44444444',
      findings: [
        ...baseSnapshot.findings,
        {
          id: 'f2',
          statement: 'New finding discovered',
          verificationStatus: 'unverified',
        },
      ],
    };

    const result = compareSnapshots(baseSnapshot, updated);
    expect(result.hasChanges).toBe(true);
    expect(result.findingsAdded).toHaveLength(1);
    expect(result.findingsAdded[0]?.statement).toBe('New finding discovered');
  });

  it('formats snapshot diff into readable output', () => {
    const updated: Snapshot = {
      ...baseSnapshot,
      id: 'cbr_diff55555555',
      task: { ...baseSnapshot.task, status: 'blocked' },
    };

    const result = compareSnapshots(baseSnapshot, updated);
    const formatted = formatComparisonReport(result);
    expect(formatted).toContain('Task changes:');
    expect(formatted).toContain('status');
  });

  it('compares snapshot with working tree without throwing', () => {
    const result = compareWithWorkingTree(baseSnapshot, process.cwd());
    expect(result.kind).toBe('snapshot-to-working-tree');
    const formatted = formatComparisonReport(result);
    expect(typeof formatted).toBe('string');
  });
});
