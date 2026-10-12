import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { collectGitInfo, isGitRepository, isGitAvailable } from '../src/adapters/git.js';
import { collectProjectInfo } from '../src/adapters/project.js';

describe('Adapters — Git Adapter', () => {
  let tempDir: string;
  let gitRepoDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-git-'));
    gitRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-repo-'));

    try {
      execSync('git init', { cwd: gitRepoDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: gitRepoDir, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: gitRepoDir, stdio: 'ignore' });
      await fs.writeFile(path.join(gitRepoDir, 'initial.txt'), 'hello');
      execSync('git add initial.txt', { cwd: gitRepoDir, stdio: 'ignore' });
      execSync('git commit -m "Initial test commit"', { cwd: gitRepoDir, stdio: 'ignore' });
    } catch {
      // If git binary is unavailable in environment, tests handle gracefully
    }
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(gitRepoDir, { recursive: true, force: true });
  });

  it('checks if git is available on system', () => {
    expect(typeof isGitAvailable()).toBe('boolean');
  });

  it('detects git repository in initialized repo', () => {
    if (!isGitAvailable()) return;
    const isRepo = isGitRepository(gitRepoDir);
    expect(isRepo).toBe(true);
  });

  it('returns false for non-git directory', () => {
    const isRepo = isGitRepository(tempDir);
    expect(isRepo).toBe(false);
  });

  it('returns available: false gracefully for non-git directory without throwing', () => {
    const gitInfo = collectGitInfo(tempDir);
    expect(gitInfo.available).toBe(false);
    expect(gitInfo.changedFiles).toEqual([]);
  });

  it('collects git state from initialized repository', async () => {
    if (!isGitAvailable()) return;
    const gitInfo = collectGitInfo(gitRepoDir);
    expect(gitInfo.available).toBe(true);
    expect(typeof gitInfo.commitHash).toBe('string');
    expect(gitInfo.commitHash?.length).toBe(40);
    expect(gitInfo.commitMessage).toBe('Initial test commit');
    expect(gitInfo.isDirty).toBe(false);

    // Make repo dirty
    await fs.writeFile(path.join(gitRepoDir, 'dirty.txt'), 'new content');
    const dirtyGitInfo = collectGitInfo(gitRepoDir);
    expect(dirtyGitInfo.isDirty).toBe(true);
    expect(dirtyGitInfo.changedFiles).toContain('dirty.txt');
  });
});

describe('Adapters — Project Adapter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-test-proj-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects package.json metadata when present', async () => {
    const pkgJson = {
      name: 'my-microservice',
      description: 'A test service',
    };
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    const projectInfo = collectProjectInfo(tempDir);
    expect(projectInfo.name).toBe('my-microservice');
    expect(projectInfo.description).toBe('A test service');
    expect(projectInfo.language).toBe('JavaScript/TypeScript');
  });

  it('falls back to directory name when no manifest exists', () => {
    const projectInfo = collectProjectInfo(tempDir);
    expect(projectInfo.name).toBe(path.basename(tempDir));
    expect(projectInfo.language).toBeUndefined();
  });
});
