import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../dist/cli/index.js');

describe('CLI Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-cli-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const runCli = async (args: string[], cwd = tempDir) => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
        cwd,
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
      });
      return { code: 0, stdout, stderr };
    } catch (err: any) {
      return {
        code: err.code ?? 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
      };
    }
  };

  it('prints version with --version', async () => {
    const res = await runCli(['--version']);
    expect(res.code).toBe(0);
    expect(res.stdout.trim()).toBe('1.0.0');
  });

  it('prints help with --help', async () => {
    const res = await runCli(['--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Usage: contextbridge');
    expect(res.stdout).toContain('init');
    expect(res.stdout).toContain('capture');
    expect(res.stdout).toContain('resume');
  });

  it('returns error when not initialized for commands requiring workspace', async () => {
    const res = await runCli(['list', '--json']);
    expect(res.code).not.toBe(0);
    const outputStr = res.stderr.trim() !== '' ? res.stderr : res.stdout;
    const parsed = JSON.parse(outputStr);
    expect(parsed.error.code).toBe('NOT_INITIALIZED');
  });

  it('initializes workspace with `init`', async () => {
    const res = await runCli(['init', '--json']);
    expect(res.code).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.wasAlreadyInitialized).toBe(false);

    // Initializing again with --force succeeds
    const res2 = await runCli(['init', '--force', '--json']);
    expect(res2.code).toBe(0);
    const parsed2 = JSON.parse(res2.stdout);
    expect(parsed2.wasAlreadyInitialized).toBe(true);
  });

  it('executes full CLI lifecycle: init -> capture -> list -> show -> export -> resume -> forget', async () => {
    // 1. init
    const initRes = await runCli(['init']);
    expect(initRes.code).toBe(0);

    // 2. capture non-interactively
    const capRes = await runCli([
      'capture',
      '--non-interactive',
      '--title',
      'E2E Test Task',
      '--objective',
      'Verify complete CLI workflow',
      '--finding',
      'CLI captures inputs deterministically',
      '--attempt',
      'Ran automated integration tests',
      '--json',
    ]);
    expect(capRes.code).toBe(0);
    const capData = JSON.parse(capRes.stdout);
    expect(capData.success).toBe(true);
    const snapshotId = capData.id;
    expect(snapshotId).toMatch(/^cbr_/);

    // 3. list
    const listRes = await runCli(['list', '--json']);
    expect(listRes.code).toBe(0);
    const listData = JSON.parse(listRes.stdout);
    expect(Array.isArray(listData)).toBe(true);
    expect(listData).toHaveLength(1);
    expect(listData[0].id).toBe(snapshotId);

    // 4. show
    const showRes = await runCli(['show', snapshotId, '--json']);
    expect(showRes.code).toBe(0);
    const showData = JSON.parse(showRes.stdout);
    expect(showData.id).toBe(snapshotId);
    expect(showData.task.title).toBe('E2E Test Task');

    // 5. export markdown to stdout
    const exportRes = await runCli(['export', snapshotId, '--format', 'markdown']);
    expect(exportRes.code).toBe(0);
    expect(exportRes.stdout).toContain('ContextBridge Handoff: E2E Test Task');

    // 6. resume
    const resumeRes = await runCli(['resume', '--json']);
    expect(resumeRes.code).toBe(0);
    const resumeData = JSON.parse(resumeRes.stdout);
    expect(resumeData.snapshot.id).toBe(snapshotId);

    // 7. forget with --yes
    const forgetRes = await runCli(['forget', snapshotId, '--yes', '--json']);
    expect(forgetRes.code).toBe(0);
    const forgetData = JSON.parse(forgetRes.stdout);
    expect(forgetData.success).toBe(true);
    expect(forgetData.id).toBe(snapshotId);

    // 8. list again should be empty
    const listResAfter = await runCli(['list', '--json']);
    expect(listResAfter.code).toBe(0);
    const listDataAfter = JSON.parse(listResAfter.stdout);
    expect(listDataAfter).toHaveLength(0);
  });
});
