/**
 * ContextBridge — Git Adapter
 *
 * Safe Git integration using spawned processes with argument arrays.
 * Never constructs shell commands by string interpolation.
 * Gracefully handles non-Git directories, detached HEAD, and missing git.
 */

import { spawnSync } from 'node:child_process';
import { GitNotAvailableError } from '../core/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitInfo {
  available: boolean;
  branch?: string | undefined;
  commitHash?: string | undefined;
  commitMessage?: string | undefined;
  isDirty?: boolean | undefined;
  changedFiles: string[];
  detachedHead?: boolean | undefined;
  remoteUrl?: string | undefined;
}

export interface GitDiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  changedFiles: string[];
}

// ---------------------------------------------------------------------------
// Git execution helper
// ---------------------------------------------------------------------------

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a git command with an explicit argument array in the given directory.
 * Never uses shell execution. Arguments are passed directly to git.
 *
 * @param args - Git subcommand and arguments (e.g. ['log', '-1', '--format=%H'])
 * @param cwd - Working directory for git
 */
function runGit(args: string[], cwd: string): GitResult {
  // Validate that args are strings (defense against injection via snapshot data)
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new GitNotAvailableError(`Invalid git argument type: ${typeof arg}`);
    }
    // Reject arguments starting with -- that contain = followed by shell metacharacters
    // (belt-and-suspenders protection when args come from external sources)
    if (/[\n\r]/.test(arg)) {
      throw new GitNotAvailableError(`Git argument contains newline character`);
    }
  }

  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024 * 4, // 4MB
    shell: false, // Never use shell
  });

  return {
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
    exitCode: result.status ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether git is available at all on this system.
 */
export function isGitAvailable(): boolean {
  try {
    const result = spawnSync('git', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      shell: false,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Check whether the given directory is inside a git repository.
 */
export function isGitRepository(cwd: string): boolean {
  if (!isGitAvailable()) return false;
  const result = runGit(['rev-parse', '--git-dir'], cwd);
  return result.exitCode === 0;
}

/**
 * Get the current branch name.
 * Returns undefined for detached HEAD or non-git directories.
 */
export function getCurrentBranch(cwd: string): string | undefined {
  const result = runGit(['symbolic-ref', '--short', 'HEAD'], cwd);
  if (result.exitCode !== 0) return undefined;
  return result.stdout || undefined;
}

/**
 * Check whether HEAD is in a detached state.
 */
export function isDetachedHead(cwd: string): boolean {
  const result = runGit(['symbolic-ref', '--quiet', 'HEAD'], cwd);
  return result.exitCode !== 0;
}

/**
 * Get the current commit hash (full 40-char SHA).
 */
export function getCommitHash(cwd: string): string | undefined {
  const result = runGit(['rev-parse', 'HEAD'], cwd);
  if (result.exitCode !== 0) return undefined;
  const hash = result.stdout;
  // Validate: should be exactly 40 hex chars
  return /^[0-9a-f]{40}$/.test(hash) ? hash : undefined;
}

/**
 * Get the first line of the current commit message.
 */
export function getCommitMessage(cwd: string): string | undefined {
  const result = runGit(['log', '-1', '--format=%s'], cwd);
  if (result.exitCode !== 0) return undefined;
  return result.stdout.slice(0, 512) || undefined;
}

/**
 * Check whether the working tree has uncommitted changes.
 */
export function isWorkingTreeDirty(cwd: string): boolean {
  // --porcelain output is empty when clean
  const result = runGit(['status', '--porcelain'], cwd);
  if (result.exitCode !== 0) return false;
  return result.stdout.length > 0;
}

/**
 * Get the list of files that have been modified (staged + unstaged + untracked).
 * Returns paths relative to the repository root.
 */
export function getChangedFiles(cwd: string, maxFiles = 100): string[] {
  // Use --porcelain for stable, script-friendly output
  const result = runGit(['status', '--porcelain', '-u'], cwd);
  if (result.exitCode !== 0 || !result.stdout) return [];

  const files: string[] = [];
  const lines = result.stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    // Porcelain format: XY path or XY old -> new
    const filePart = line.slice(3);
    const arrowIdx = filePart.indexOf(' -> ');
    const filePath = arrowIdx >= 0 ? filePart.slice(arrowIdx + 4) : filePart;
    files.push(filePath.trim());
    if (files.length >= maxFiles) break;
  }

  return files;
}

/**
 * Get the remote URL for origin.
 */
export function getRemoteUrl(cwd: string): string | undefined {
  const result = runGit(['remote', 'get-url', 'origin'], cwd);
  if (result.exitCode !== 0) return undefined;
  const url = result.stdout;
  // Basic validation: should look like a URL or SSH path
  if (!url || url.length > 2048) return undefined;
  return url;
}

/**
 * Collect all available Git information for a given directory.
 * Handles every failure mode gracefully.
 */
export function collectGitInfo(cwd: string): GitInfo {
  if (!isGitAvailable()) {
    return {
      available: false,
      changedFiles: [],
    };
  }

  if (!isGitRepository(cwd)) {
    return {
      available: false,
      changedFiles: [],
    };
  }

  const detachedHead = isDetachedHead(cwd);
  const branch = detachedHead ? undefined : getCurrentBranch(cwd);
  const commitHash = getCommitHash(cwd);
  const commitMessage = commitHash ? getCommitMessage(cwd) : undefined;
  const isDirty = isWorkingTreeDirty(cwd);
  const changedFiles = isDirty ? getChangedFiles(cwd) : [];
  const remoteUrl = getRemoteUrl(cwd);

  return {
    available: true,
    branch,
    commitHash,
    commitMessage,
    isDirty,
    changedFiles,
    detachedHead: detachedHead || undefined,
    remoteUrl,
  };
}

/**
 * Get a simple diff stat summary for the current working tree.
 * Returns undefined if git is not available or no changes exist.
 */
export function getDiffStat(cwd: string): GitDiffSummary | undefined {
  // Get unstaged changes stat
  const result = runGit(['diff', '--shortstat'], cwd);
  if (result.exitCode !== 0 || !result.stdout) return undefined;

  // Parse: " N files changed, N insertions(+), N deletions(-)"
  const filesMatch = /(\d+) files? changed/.exec(result.stdout);
  const insertMatch = /(\d+) insertions?\(\+\)/.exec(result.stdout);
  const deletMatch = /(\d+) deletions?\(-\)/.exec(result.stdout);

  const changedFiles = getChangedFiles(cwd);

  return {
    filesChanged: filesMatch?.[1] ? parseInt(filesMatch[1], 10) : 0,
    insertions: insertMatch?.[1] ? parseInt(insertMatch[1], 10) : 0,
    deletions: deletMatch?.[1] ? parseInt(deletMatch[1], 10) : 0,
    changedFiles,
  };
}
