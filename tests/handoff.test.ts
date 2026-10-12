import { describe, it, expect } from 'vitest';
import { generateMarkdownHandoff, estimateTokenCount } from '../src/core/handoff.js';
import type { Snapshot } from '../src/schema/snapshot.js';

describe('Handoff — Markdown Generation', () => {
  const fullSnapshot: Snapshot = {
    schemaVersion: '1.0.0',
    id: 'cbr_handoff123456',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:30:00.000Z',
    task: {
      title: 'Fix race condition in background queue',
      objective: 'Prevent duplicate job processing during node worker restarts',
      status: 'blocked',
      notes: 'Investigating Redis redlock vs atomic Lua script',
    },
    project: {
      name: 'queue-service',
      rootPath: '/app',
    },
    git: {
      available: true,
      branch: 'bugfix/queue-race',
      commitHash: '1234567890abcdef1234567890abcdef12345678',
      commitMessage: 'Add failing test for queue concurrency',
      isDirty: true,
      changedFiles: ['src/queue.ts', 'tests/queue.test.ts'],
    },
    findings: [
      {
        id: 'find_1',
        statement: 'Two workers pull the same job payload when Redis consumer group ack is delayed',
        verificationStatus: 'verified',
        source: 'src/queue.ts:L88',
      },
    ],
    attempts: [
      {
        id: 'att_1',
        description: 'Used advisory locks in postgres',
        outcome: 'High lock contention degraded database throughput',
        result: 'failed',
      },
    ],
    decisions: [
      {
        id: 'dec_1',
        decision: 'Use atomic Lua script in Redis for job claim',
        rationale: 'Avoids distributed lock overhead while guaranteeing atomicity',
      },
    ],
    openQuestions: [
      {
        id: 'q_1',
        question: 'Does Lua script execution cause redis latency spikes under 10k ops/sec?',
      },
    ],
    nextSteps: [
      {
        id: 'step_1',
        step: 'Benchmark Lua script in load testing environment',
        priority: 'high',
      },
    ],
    sources: [],
    privacy: {
      excludedPaths: ['**/*.env*'],
      redactedFields: [],
    },
  };

  it('generates a full Markdown handoff with all sections', () => {
    const md = generateMarkdownHandoff(fullSnapshot);

    expect(md).toContain('# ContextBridge Handoff: Fix race condition in background queue');
    expect(md).toContain('**Status:** 🔴 Blocked');
    expect(md).toContain('Prevent duplicate job processing');
    expect(md).toContain('## Repository State');
    expect(md).toContain('bugfix/queue-race');
    expect(md).toContain('## Findings');
    expect(md).toContain('src/queue.ts:L88');
    expect(md).toContain('## Attempts');
    expect(md).toContain('Used advisory locks in postgres');
    expect(md).toContain('## Decisions');
    expect(md).toContain('Use atomic Lua script in Redis for job claim');
    expect(md).toContain('## Open Questions');
    expect(md).toContain('Does Lua script execution cause redis latency spikes');
    expect(md).toContain('## Next Steps');
    expect(md).toContain('Benchmark Lua script in load testing environment');
  });

  it('generates compact handoff when requested', () => {
    const compactMd = generateMarkdownHandoff(fullSnapshot, { compact: true });
    expect(compactMd).toContain('# ContextBridge Handoff: Fix race condition in background queue');
    expect(compactMd.length).toBeLessThan(generateMarkdownHandoff(fullSnapshot).length);
  });

  it('estimates token count reasonably', () => {
    const text = 'This is a sample sentence with several words that takes some tokens.';
    const estimate = estimateTokenCount(text);
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(text.length);
  });
});
