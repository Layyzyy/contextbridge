/**
 * ContextBridge — Snapshot Comparison
 *
 * Compares two snapshots or a snapshot against the current working repository.
 * Never modifies the repository. Reports missing information clearly.
 */

import type { Snapshot, Finding, Attempt, NextStep } from '../schema/snapshot.js';
import { collectGitInfo } from '../adapters/git.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldDiff {
  field: string;
  kind: ChangeKind;
  before?: string | undefined;
  after?: string | undefined;
}

export interface ComparisonResult {
  /** Type of comparison performed */
  kind: 'snapshot-to-snapshot' | 'snapshot-to-working-tree';

  /** Summary of changes found */
  hasChanges: boolean;

  /** Git-related changes */
  git: FieldDiff[];

  /** Task-related changes */
  task: FieldDiff[];

  /** Added findings */
  findingsAdded: Finding[];

  /** Removed findings */
  findingsRemoved: Finding[];

  /** Added attempts */
  attemptsAdded: Attempt[];

  /** Steps changed */
  nextStepsChanged: FieldDiff[];

  /** Free-form warnings */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Snapshot-to-snapshot comparison
// ---------------------------------------------------------------------------

/**
 * Compare two snapshots. Clearly marks what changed between them.
 * Never modifies any file.
 */
export function compareSnapshots(before: Snapshot, after: Snapshot): ComparisonResult {
  const result: ComparisonResult = {
    kind: 'snapshot-to-snapshot',
    hasChanges: false,
    git: [],
    task: [],
    findingsAdded: [],
    findingsRemoved: [],
    attemptsAdded: [],
    nextStepsChanged: [],
    warnings: [],
  };

  // Task changes
  comparePrimitive(result.task, 'title', before.task.title, after.task.title);
  comparePrimitive(result.task, 'status', before.task.status, after.task.status);
  comparePrimitive(result.task, 'objective', before.task.objective, after.task.objective);
  comparePrimitive(result.task, 'notes', before.task.notes ?? '', after.task.notes ?? '');

  // Git changes
  comparePrimitive(
    result.git,
    'branch',
    before.git.branch ?? '(none)',
    after.git.branch ?? '(none)',
  );
  comparePrimitive(
    result.git,
    'commitHash',
    before.git.commitHash?.slice(0, 8) ?? '(none)',
    after.git.commitHash?.slice(0, 8) ?? '(none)',
  );
  comparePrimitive(
    result.git,
    'isDirty',
    String(before.git.isDirty ?? false),
    String(after.git.isDirty ?? false),
  );

  // Findings
  const beforeFindingIds = new Set(before.findings.map((f) => f.id));
  const afterFindingIds = new Set(after.findings.map((f) => f.id));

  result.findingsAdded = after.findings.filter((f) => !beforeFindingIds.has(f.id));
  result.findingsRemoved = before.findings.filter((f) => !afterFindingIds.has(f.id));

  // Attempts
  const beforeAttemptIds = new Set(before.attempts.map((a) => a.id));
  result.attemptsAdded = after.attempts.filter((a) => !beforeAttemptIds.has(a.id));

  // Next steps
  compareListItems(result.nextStepsChanged, 'nextStep', before.nextSteps, after.nextSteps);

  // Determine if anything changed
  result.hasChanges =
    result.git.some((d) => d.kind !== 'unchanged') ||
    result.task.some((d) => d.kind !== 'unchanged') ||
    result.findingsAdded.length > 0 ||
    result.findingsRemoved.length > 0 ||
    result.attemptsAdded.length > 0 ||
    result.nextStepsChanged.some((d) => d.kind !== 'unchanged');

  return result;
}

// ---------------------------------------------------------------------------
// Snapshot-to-working-tree comparison
// ---------------------------------------------------------------------------

/**
 * Compare a snapshot with the current working tree state.
 * Reports divergences between the saved state and the current repository.
 */
export function compareWithWorkingTree(snapshot: Snapshot, cwd: string): ComparisonResult {
  const result: ComparisonResult = {
    kind: 'snapshot-to-working-tree',
    hasChanges: false,
    git: [],
    task: [],
    findingsAdded: [],
    findingsRemoved: [],
    attemptsAdded: [],
    nextStepsChanged: [],
    warnings: [],
  };

  const currentGit = collectGitInfo(cwd);

  if (!snapshot.git.available && !currentGit.available) {
    result.warnings.push(
      'Git was not available when the snapshot was created and is still not available.',
    );
    return result;
  }

  if (!snapshot.git.available && currentGit.available) {
    result.warnings.push(
      'Git was not available when the snapshot was created, but is now available. ' +
        'Git state comparison is not possible.',
    );
    return result;
  }

  if (snapshot.git.available && !currentGit.available) {
    result.warnings.push(
      'Git was available when the snapshot was created, but is not available now.',
    );
    return result;
  }

  // Compare branches
  comparePrimitive(
    result.git,
    'branch',
    snapshot.git.branch ?? '(none)',
    currentGit.branch ?? '(none)',
  );

  // Compare commit hashes
  if (snapshot.git.commitHash && currentGit.commitHash) {
    if (snapshot.git.commitHash !== currentGit.commitHash) {
      result.git.push({
        field: 'commit',
        kind: 'changed',
        before: snapshot.git.commitHash.slice(0, 8),
        after: currentGit.commitHash.slice(0, 8),
      });
    } else {
      result.git.push({
        field: 'commit',
        kind: 'unchanged',
        before: snapshot.git.commitHash.slice(0, 8),
        after: currentGit.commitHash.slice(0, 8),
      });
    }
  } else if (!snapshot.git.commitHash && !currentGit.commitHash) {
    result.warnings.push(
      'Commit hash was not available in either the snapshot or the current state.',
    );
  } else {
    result.warnings.push('Commit hash comparison is incomplete: one side has no commit hash.');
  }

  // Compare dirty state
  comparePrimitive(
    result.git,
    'isDirty',
    String(snapshot.git.isDirty ?? false),
    String(currentGit.isDirty ?? false),
  );

  // Count changed files
  const snapshotFileCount = snapshot.git.changedFiles.length;
  const currentFileCount = currentGit.changedFiles.length;
  if (snapshotFileCount !== currentFileCount) {
    result.git.push({
      field: 'changedFileCount',
      kind: 'changed',
      before: String(snapshotFileCount),
      after: String(currentFileCount),
    });
  }

  result.hasChanges = result.git.some((d) => d.kind !== 'unchanged') || result.warnings.length > 0;

  return result;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Format a ComparisonResult as a human-readable text report.
 */
export function formatComparisonReport(result: ComparisonResult): string {
  const lines: string[] = [];

  const compType =
    result.kind === 'snapshot-to-snapshot'
      ? 'Snapshot-to-snapshot comparison'
      : 'Snapshot vs. working tree';

  lines.push(compType);
  lines.push('='.repeat(compType.length));
  lines.push('');

  if (!result.hasChanges && result.warnings.length === 0) {
    lines.push('No changes detected.');
    return lines.join('\n');
  }

  if (result.warnings.length > 0) {
    lines.push('⚠️  Warnings:');
    result.warnings.forEach((w) => lines.push(`  - ${w}`));
    lines.push('');
  }

  const changedGit = result.git.filter((d) => d.kind !== 'unchanged');
  if (changedGit.length > 0) {
    lines.push('Git changes:');
    changedGit.forEach((d) => {
      lines.push(`  ${d.field}: ${d.before ?? '(none)'} → ${d.after ?? '(none)'}`);
    });
    lines.push('');
  }

  const changedTask = result.task.filter((d) => d.kind !== 'unchanged');
  if (changedTask.length > 0) {
    lines.push('Task changes:');
    changedTask.forEach((d) => {
      lines.push(`  ${d.field}: ${d.before ?? '(none)'} → ${d.after ?? '(none)'}`);
    });
    lines.push('');
  }

  if (result.findingsAdded.length > 0) {
    lines.push('Findings added:');
    result.findingsAdded.forEach((f) => {
      lines.push(`  + [${f.verificationStatus}] ${f.statement}`);
    });
    lines.push('');
  }

  if (result.findingsRemoved.length > 0) {
    lines.push('Findings removed:');
    result.findingsRemoved.forEach((f) => {
      lines.push(`  - [${f.verificationStatus}] ${f.statement}`);
    });
    lines.push('');
  }

  if (result.attemptsAdded.length > 0) {
    lines.push('Attempts added:');
    result.attemptsAdded.forEach((a) => {
      lines.push(`  + [${a.result}] ${a.description}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function comparePrimitive(diffs: FieldDiff[], field: string, before: string, after: string): void {
  diffs.push({
    field,
    kind: before === after ? 'unchanged' : 'changed',
    before,
    after,
  });
}

function compareListItems(
  diffs: FieldDiff[],
  prefix: string,
  before: NextStep[],
  after: NextStep[],
): void {
  const beforeMap = new Map(before.map((s) => [s.id, s]));
  const afterMap = new Map(after.map((s) => [s.id, s]));

  for (const [id, step] of afterMap) {
    if (!beforeMap.has(id)) {
      diffs.push({ field: `${prefix}[${id}]`, kind: 'added', after: step.step });
    } else {
      const beforeStep = beforeMap.get(id);
      if (beforeStep && beforeStep.step !== step.step) {
        diffs.push({
          field: `${prefix}[${id}]`,
          kind: 'changed',
          before: beforeStep.step,
          after: step.step,
        });
      }
    }
  }

  for (const [id, step] of beforeMap) {
    if (!afterMap.has(id)) {
      diffs.push({ field: `${prefix}[${id}]`, kind: 'removed', before: step.step });
    }
  }
}
