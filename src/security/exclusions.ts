/**
 * ContextBridge — File Exclusions
 *
 * Default and configurable exclusion rules for sensitive files and directories.
 * Used during context capture to prevent accidental inclusion of secrets,
 * credentials, or irrelevant build artifacts.
 */

import path from 'node:path';
import { minimatch } from 'minimatch';

// ---------------------------------------------------------------------------
// Default exclusion patterns
// ---------------------------------------------------------------------------

/**
 * Default patterns that are ALWAYS excluded, regardless of user configuration.
 * These protect against accidental secret exposure.
 *
 * Security note: These patterns are best-effort. Users who explicitly and
 * deliberately reference secret files by absolute path can bypass them.
 * Never claim to guarantee perfect secret prevention.
 */
export const DEFAULT_EXCLUSIONS: readonly string[] = [
  // Environment and secrets
  '.env',
  '.env.*',
  '*.env',
  '.envrc',

  // Private keys and certificates
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.crt',
  '*.cer',
  '*.der',
  '*.keystore',
  '*.jks',
  'id_rsa',
  'id_rsa.*',
  'id_ecdsa',
  'id_ed25519',
  '*.ppk',

  // Credential and secret files
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.aws/credentials',
  '.aws/config',
  '.gcloud/credentials.db',
  '.gcloud/access_tokens.db',
  'credentials.json',
  'service-account.json',
  'serviceaccount.json',
  '*secret*',
  '*secrets*',
  '*credential*',
  '*credentials*',
  '*password*',
  '*passwd*',
  '*token*',

  // Common config files that often contain secrets
  'config/secrets.yml',
  'config/secrets.yaml',
  'config/master.key',
  '.master.key',
  'master.key',

  // Docker/compose secrets
  'docker-compose.override.yml',
  '**/secrets/**',

  // Node.js
  'node_modules/**',
  '.npm/**',

  // Python
  '__pycache__/**',
  '*.pyc',
  '.venv/**',
  'venv/**',
  'env/**',

  // Build artifacts
  'dist/**',
  'build/**',
  'out/**',
  '.next/**',
  '.nuxt/**',
  'target/**',
  '*.class',
  '*.jar',

  // ContextBridge's own storage (prevent recursive capture)
  '.contextbridge/**',

  // Version control
  '.git/**',

  // Lock files (large, noisy, rarely useful)
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'Gemfile.lock',
  'Cargo.lock',

  // OS artifacts
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',

  // Editor artifacts
  '.idea/**',
  '.vscode/**',
  '*.swp',
  '*.swo',

  // Logs (can be large and noisy)
  '*.log',
  'logs/**',
];

// ---------------------------------------------------------------------------
// Exclusion checking
// ---------------------------------------------------------------------------

export interface ExclusionOptions {
  /** Additional user-defined patterns to exclude */
  additionalPatterns?: readonly string[];
  /** If true, always apply default exclusions (default: true) */
  applyDefaults?: boolean;
}

/**
 * Build a combined list of exclusion patterns.
 */
export function buildExclusionPatterns(options: ExclusionOptions = {}): string[] {
  const { additionalPatterns = [], applyDefaults = true } = options;
  const base = applyDefaults ? [...DEFAULT_EXCLUSIONS] : [];
  return [...base, ...additionalPatterns];
}

/**
 * Test whether a file path matches any of the exclusion patterns.
 *
 * @param filePath - The file path to test (should be relative to project root)
 * @param patterns - Array of glob patterns to test against
 */
export function isExcluded(filePath: string, patterns: string[]): boolean {
  // Normalize to forward slashes for consistent matching
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized);

  for (const pattern of patterns) {
    // Test the full path against the pattern
    if (minimatch(normalized, pattern, { dot: true, matchBase: false })) {
      return true;
    }
    // Also test just the basename for simple filename patterns
    if (minimatch(basename, pattern, { dot: true, matchBase: true })) {
      return true;
    }
    // Test path components for directory patterns like 'node_modules/**'
    const patternWithoutGlob = pattern.replace(/\/\*\*.*$/, '');
    if (
      pattern.endsWith('/**') &&
      (normalized.startsWith(patternWithoutGlob + '/') || normalized === patternWithoutGlob)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Filter an array of paths, removing excluded ones.
 * Returns both the included paths and the excluded paths with their matching patterns.
 */
export function filterExcluded(
  paths: string[],
  options: ExclusionOptions = {},
): { included: string[]; excluded: { path: string; reason: string }[] } {
  const patterns = buildExclusionPatterns(options);
  const included: string[] = [];
  const excluded: { path: string; reason: string }[] = [];

  for (const p of paths) {
    if (isExcluded(p, patterns)) {
      excluded.push({ path: p, reason: 'Matches exclusion pattern' });
    } else {
      included.push(p);
    }
  }

  return { included, excluded };
}
