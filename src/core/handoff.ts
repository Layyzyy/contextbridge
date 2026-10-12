/**
 * ContextBridge — Handoff Generation
 *
 * Generates human-readable and AI-friendly Markdown handoffs from snapshots.
 * Also supports JSON export. Clearly marks what is verified vs unverified.
 */

import type {
  Snapshot,
  Finding,
  Attempt,
  Decision,
  NextStep,
  OpenQuestion,
} from '../schema/snapshot.js';

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    active: '🟢 Active',
    blocked: '🔴 Blocked',
    completed: '✅ Completed',
    abandoned: '⚫ Abandoned',
  };
  return badges[status] ?? status;
}

function verificationBadge(status: string): string {
  const badges: Record<string, string> = {
    verified: '✅ Verified',
    unverified: '⚠️ Unverified',
    assumption: '💭 Assumption',
  };
  return badges[status] ?? status;
}

function resultBadge(result: string): string {
  const badges: Record<string, string> = {
    succeeded: '✅ Succeeded',
    failed: '❌ Failed',
    unknown: '❓ Unknown',
  };
  return badges[result] ?? result;
}

function priorityBadge(priority: string | undefined): string {
  if (!priority) return '';
  const badges: Record<string, string> = {
    high: '🔴 High',
    medium: '🟡 Medium',
    low: '🔵 Low',
  };
  return badges[priority] ?? priority;
}

function renderFindings(findings: Finding[]): string {
  if (findings.length === 0) return '_No findings recorded._\n';
  return findings
    .map(
      (f) =>
        `- ${verificationBadge(f.verificationStatus)}: ${f.statement}` +
        (f.source ? `\n  - Source: ${f.source}` : '') +
        (f.observedAt ? `\n  - Observed: ${formatDate(f.observedAt)}` : ''),
    )
    .join('\n');
}

function renderAttempts(attempts: Attempt[]): string {
  if (attempts.length === 0) return '_No attempts recorded._\n';
  return attempts
    .map(
      (a) =>
        `- ${resultBadge(a.result)}: ${a.description}\n` +
        `  - Outcome: ${a.outcome}` +
        (a.errorDetails ? `\n  - Error: ${a.errorDetails}` : '') +
        (a.reference ? `\n  - Reference: ${a.reference}` : ''),
    )
    .join('\n');
}

function renderDecisions(decisions: Decision[]): string {
  if (decisions.length === 0) return '_No decisions recorded._\n';
  return decisions
    .map(
      (d) =>
        `- **${d.decision}**\n  - Rationale: ${d.rationale}` +
        (d.madeAt ? `\n  - Made at: ${formatDate(d.madeAt)}` : ''),
    )
    .join('\n');
}

function renderNextSteps(steps: NextStep[]): string {
  if (steps.length === 0) return '_No next steps recorded._\n';
  return steps
    .map((s) => `- ${s.step}${s.priority ? ` _(${priorityBadge(s.priority)})_` : ''}`)
    .join('\n');
}

function renderOpenQuestions(questions: OpenQuestion[]): string {
  if (questions.length === 0) return '_No open questions recorded._\n';
  return questions.map((q) => `- ${q.question}`).join('\n');
}

/**
 * Generate a full Markdown handoff document from a snapshot.
 * Suitable for pasting into an AI conversation or sharing with a teammate.
 */
export function generateMarkdownHandoff(snapshot: Snapshot, options: HandoffOptions = {}): string {
  const { includeMetadata = true, compact = false } = options;
  const lines: string[] = [];

  lines.push(`# ContextBridge Handoff: ${snapshot.task.title}`);
  lines.push('');

  if (includeMetadata) {
    lines.push(`> **Status:** ${statusBadge(snapshot.task.status)}`);
    lines.push(`> **Captured:** ${formatDate(snapshot.createdAt)}`);
    if (snapshot.updatedAt !== snapshot.createdAt) {
      lines.push(`> **Updated:** ${formatDate(snapshot.updatedAt)}`);
    }
    lines.push(`> **Snapshot ID:** \`${snapshot.id}\``);
    lines.push(`> **Schema Version:** ${snapshot.schemaVersion}`);
    lines.push('');
  }

  lines.push('## Objective');
  lines.push('');
  lines.push(snapshot.task.objective);
  lines.push('');

  if (snapshot.task.notes) {
    lines.push('## Notes');
    lines.push('');
    lines.push(snapshot.task.notes);
    lines.push('');
  }

  // Project info
  if (!compact) {
    lines.push('## Project');
    lines.push('');
    if (snapshot.project.name) lines.push(`- **Name:** ${snapshot.project.name}`);
    if (snapshot.project.language) lines.push(`- **Language:** ${snapshot.project.language}`);
    if (snapshot.project.description)
      lines.push(`- **Description:** ${snapshot.project.description}`);
    lines.push('');
  }

  // Git state
  if (snapshot.git.available) {
    lines.push('## Repository State');
    lines.push('');
    if (snapshot.git.branch) lines.push(`- **Branch:** \`${snapshot.git.branch}\``);
    if (snapshot.git.commitHash) {
      lines.push(`- **Commit:** \`${snapshot.git.commitHash.slice(0, 8)}\``);
    }
    if (snapshot.git.commitMessage) lines.push(`- **Message:** ${snapshot.git.commitMessage}`);
    if (snapshot.git.isDirty) {
      lines.push(`- **Working tree:** Dirty (${snapshot.git.changedFiles.length} changed files)`);
      if (!compact && snapshot.git.changedFiles.length > 0) {
        lines.push('- **Changed files:**');
        snapshot.git.changedFiles.slice(0, 20).forEach((f) => lines.push(`  - \`${f}\``));
        if (snapshot.git.changedFiles.length > 20) {
          lines.push(`  - _(${snapshot.git.changedFiles.length - 20} more files not shown)_`);
        }
      }
    } else {
      lines.push('- **Working tree:** Clean');
    }
    if (snapshot.git.detachedHead) {
      lines.push('- ⚠️ **HEAD is detached**');
    }
    lines.push('');
  } else {
    lines.push('## Repository State');
    lines.push('');
    lines.push('_Not a Git repository or Git not available._');
    lines.push('');
  }

  lines.push('## Findings');
  lines.push('');
  lines.push('> ✅ Verified = confirmed through testing/observation  ');
  lines.push('> ⚠️ Unverified = stated but not yet confirmed  ');
  lines.push('> 💭 Assumption = believed but not validated  ');
  lines.push('');
  lines.push(renderFindings(snapshot.findings));
  lines.push('');

  lines.push('## Attempts');
  lines.push('');
  lines.push(renderAttempts(snapshot.attempts));
  lines.push('');

  if (!compact) {
    lines.push('## Decisions');
    lines.push('');
    lines.push(renderDecisions(snapshot.decisions));
    lines.push('');
  }

  lines.push('## Open Questions');
  lines.push('');
  lines.push(renderOpenQuestions(snapshot.openQuestions));
  lines.push('');

  lines.push('## Next Steps');
  lines.push('');
  lines.push(renderNextSteps(snapshot.nextSteps));
  lines.push('');

  lines.push('---');
  lines.push(
    '_Generated by [ContextBridge](https://github.com/Layyzyy/contextbridge). ' +
      'Local-first context management for developers._',
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a compact terminal summary for `contextbridge resume`.
 */
export function generateTerminalSummary(snapshot: Snapshot): string {
  const lines: string[] = [];

  lines.push(`Task: ${snapshot.task.title}`);
  lines.push(`Status: ${snapshot.task.status}`);
  lines.push(`Captured: ${formatDate(snapshot.createdAt)}`);
  lines.push('');
  lines.push('Objective:');
  lines.push(snapshot.task.objective);

  if (snapshot.git.available && snapshot.git.branch) {
    lines.push('');
    lines.push(`Branch: ${snapshot.git.branch}`);
    if (snapshot.git.isDirty) {
      lines.push(`Working tree: dirty (${snapshot.git.changedFiles.length} changed files)`);
    }
  }

  if (snapshot.findings.length > 0) {
    lines.push('');
    lines.push('Key Findings:');
    snapshot.findings.slice(0, 5).forEach((f) => {
      lines.push(`  [${f.verificationStatus.toUpperCase()}] ${f.statement}`);
    });
    if (snapshot.findings.length > 5) {
      lines.push(`  ... and ${snapshot.findings.length - 5} more`);
    }
  }

  if (snapshot.attempts.length > 0) {
    const failed = snapshot.attempts.filter((a) => a.result === 'failed');
    if (failed.length > 0) {
      lines.push('');
      lines.push('Failed Attempts:');
      failed.slice(0, 3).forEach((a) => {
        lines.push(`  ✗ ${a.description}`);
      });
    }
  }

  if (snapshot.openQuestions.length > 0) {
    lines.push('');
    lines.push('Open Questions:');
    snapshot.openQuestions.slice(0, 3).forEach((q) => {
      lines.push(`  ? ${q.question}`);
    });
  }

  if (snapshot.nextSteps.length > 0) {
    lines.push('');
    lines.push('Next Steps:');
    snapshot.nextSteps.slice(0, 5).forEach((s) => {
      lines.push(`  → ${s.step}`);
    });
  }

  return lines.join('\n');
}

export interface HandoffOptions {
  /** Include snapshot ID and metadata header */
  includeMetadata?: boolean;
  /** Compact mode: skip decisions and large file lists */
  compact?: boolean;
}

/**
 * Estimate token count using the standard heuristic (~4 characters per token).
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
