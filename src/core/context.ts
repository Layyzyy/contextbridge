/**
 * ContextBridge — Context Collection
 *
 * Assembles context from various adapters into a draft snapshot,
 * carefully separating automatically collected data from user-supplied data.
 */

import { collectGitInfo } from '../adapters/git.js';
import { collectProjectInfo } from '../adapters/project.js';
import {
  type Snapshot,
  type Task,
  type GitState,
  type Finding,
  type Attempt,
  type Decision,
  type OpenQuestion,
  type NextStep,
  SCHEMA_VERSION,
} from '../schema/snapshot.js';
import { generateSnapshotId } from '../storage/snapshot-store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaptureInput {
  /** Working directory for the project */
  cwd: string;

  /** Task title */
  title: string;

  /** Task objective */
  objective: string;

  /** Task status */
  status: Task['status'];

  /** Developer notes */
  notes?: string | undefined;

  /** Findings (verified, unverified, assumptions) */
  findings?: Omit<Finding, 'id'>[] | undefined;

  /** Failed/succeeded attempts */
  attempts?: Omit<Attempt, 'id'>[] | undefined;

  /** Technical decisions */
  decisions?: Omit<Decision, 'id'>[] | undefined;

  /** Open questions */
  openQuestions?: Omit<OpenQuestion, 'id'>[] | undefined;

  /** Next steps */
  nextSteps?: Omit<NextStep, 'id'>[] | undefined;

  /** Excluded path patterns (added to defaults) */
  additionalExclusions?: string[] | undefined;
}

// ---------------------------------------------------------------------------
// ID helpers for list items
// ---------------------------------------------------------------------------

let idCounter = 0;
function makeItemId(prefix: string): string {
  return `${prefix}_${(++idCounter).toString().padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Context assembler
// ---------------------------------------------------------------------------

/**
 * Assemble a complete Snapshot from a CaptureInput.
 * Automatically collects git and project info from the working directory.
 */
export function assembleSnapshot(input: CaptureInput): Snapshot {
  const now = new Date().toISOString();
  const id = generateSnapshotId();

  // Collect automatic data
  const gitInfo = collectGitInfo(input.cwd);
  const projectInfo = collectProjectInfo(input.cwd);

  // Build git state (never fail if git not available)
  const git: GitState = {
    available: gitInfo.available,
    branch: gitInfo.branch,
    commitHash: gitInfo.commitHash,
    commitMessage: gitInfo.commitMessage,
    isDirty: gitInfo.isDirty,
    changedFiles: gitInfo.changedFiles,
    detachedHead: gitInfo.detachedHead,
    remoteUrl: gitInfo.remoteUrl,
  };

  // Build findings with IDs
  const findings: Finding[] = (input.findings ?? []).map((f, i) => ({
    ...f,
    id: makeItemId(`f${i}`),
  }));

  // Build attempts with IDs
  const attempts: Attempt[] = (input.attempts ?? []).map((a, i) => ({
    ...a,
    id: makeItemId(`a${i}`),
  }));

  // Build decisions with IDs
  const decisions: Decision[] = (input.decisions ?? []).map((d, i) => ({
    ...d,
    id: makeItemId(`d${i}`),
  }));

  // Build open questions with IDs
  const openQuestions: OpenQuestion[] = (input.openQuestions ?? []).map((q, i) => ({
    ...q,
    id: makeItemId(`q${i}`),
  }));

  // Build next steps with IDs
  const nextSteps: NextStep[] = (input.nextSteps ?? []).map((s, i) => ({
    ...s,
    id: makeItemId(`s${i}`),
  }));

  const snapshot: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    id,
    createdAt: now,
    updatedAt: now,
    task: {
      title: input.title,
      objective: input.objective,
      status: input.status,
      notes: input.notes,
    },
    project: {
      name: projectInfo.name,
      rootPath: projectInfo.rootPath,
      language: projectInfo.language,
      description: projectInfo.description,
    },
    git,
    findings,
    attempts,
    decisions,
    openQuestions,
    nextSteps,
    sources: [],
    privacy: {
      excludedPaths: input.additionalExclusions ?? [],
      redactedFields: [],
    },
  };

  return snapshot;
}
