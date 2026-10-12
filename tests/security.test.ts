import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  resolveAndValidate,
  isWithinRoot,
  PathTraversalError,
  InvalidPathError,
} from '../src/security/path-safety.js';
import {
  isExcluded,
  filterExcluded,
  buildExclusionPatterns,
  DEFAULT_EXCLUSIONS,
} from '../src/security/exclusions.js';
import {
  detectSecrets,
  redactSecrets,
  redactObject,
  REDACTION_MARKER,
} from '../src/security/redaction.js';

describe('Security — Path Safety', () => {
  const root = '/app/workspace';

  it('validates safe paths within root', () => {
    const resolved = resolveAndValidate(root, 'src/index.ts');
    expect(resolved).toBe(path.resolve(root, 'src/index.ts'));
  });

  it('detects and blocks path traversal attempts', () => {
    expect(() => resolveAndValidate(root, '../../../etc/passwd')).toThrow(PathTraversalError);
    expect(() => resolveAndValidate(root, 'sub/../../../../secret.key')).toThrow(
      PathTraversalError,
    );
  });

  it('detects null bytes in paths', () => {
    expect(() => resolveAndValidate(root, 'src/\0malicious.ts')).toThrow(InvalidPathError);
  });

  it('checks if a path is within root correctly', () => {
    expect(isWithinRoot('/app/workspace/foo/bar.txt', '/app/workspace')).toBe(true);
    expect(isWithinRoot('/app/workspace', '/app/workspace')).toBe(true);
    expect(isWithinRoot('/app/other/file.txt', '/app/workspace')).toBe(false);
  });
});

describe('Security — Exclusions Engine', () => {
  it('includes default sensitive patterns', () => {
    expect(DEFAULT_EXCLUSIONS).toContain('.env');
    expect(DEFAULT_EXCLUSIONS).toContain('id_rsa');
    expect(DEFAULT_EXCLUSIONS).toContain('*.pem');
  });

  it('excludes common sensitive files', () => {
    const patterns = buildExclusionPatterns();
    expect(isExcluded('.env', patterns)).toBe(true);
    expect(isExcluded('.env.production', patterns)).toBe(true);
    expect(isExcluded('config/id_rsa', patterns)).toBe(true);
    expect(isExcluded('certs/server.key', patterns)).toBe(true);
    expect(isExcluded('node_modules/package.json', patterns)).toBe(true);
    expect(isExcluded('.git/HEAD', patterns)).toBe(true);
  });

  it('allows safe files', () => {
    const patterns = buildExclusionPatterns();
    expect(isExcluded('src/app.ts', patterns)).toBe(false);
    expect(isExcluded('README.md', patterns)).toBe(false);
    expect(isExcluded('package.json', patterns)).toBe(false);
  });

  it('filters a list of file paths', () => {
    const files = ['src/index.ts', '.env', 'keys/cert.pem', 'tests/index.test.ts', 'secrets.json'];
    const { included, excluded } = filterExcluded(files);
    expect(included).toEqual(['src/index.ts', 'tests/index.test.ts']);
    expect(excluded.length).toBe(3);
  });

  it('supports custom additional exclusions', () => {
    const customPatterns = buildExclusionPatterns({
      additionalPatterns: ['*.draft.md', 'internal/**'],
    });
    expect(isExcluded('notes.draft.md', customPatterns)).toBe(true);
    expect(isExcluded('internal/spec.txt', customPatterns)).toBe(true);
  });
});

describe('Security — Secret Detection & Redaction', () => {
  it('detects common secrets in text', () => {
    const sampleWithAws = 'AKIAIOSFODNN7EXAMPLE is an AWS key';
    const result = detectSecrets(sampleWithAws);
    expect(result.found).toBe(true);
    expect(result.matches.some((m) => m.patternName === 'AWS Access Key ID')).toBe(true);
  });

  it('detects GitHub and Slack tokens', () => {
    const ghText = 'Token: ghp_1234567890abcdef1234567890abcdef1234';
    const ghResult = detectSecrets(ghText);
    expect(ghResult.found).toBe(true);
    expect(ghResult.matches.some((m) => m.patternName.includes('GitHub'))).toBe(true);

    const slackText = 'Slack: xoxb-123456789-abcdef';
    const slackResult = detectSecrets(slackText);
    expect(slackResult.found).toBe(true);
    expect(slackResult.matches.some((m) => m.patternName.includes('Slack'))).toBe(true);
  });

  it('detects private key headers', () => {
    const rsa = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----';
    const result = detectSecrets(rsa);
    expect(result.found).toBe(true);
    expect(result.matches.some((m) => m.patternName === 'Private key')).toBe(true);
  });

  it('redacts secrets from text without mutating surrounding content', () => {
    const raw = 'Config: AKIAIOSFODNN7EXAMPLE on region us-east-1';
    const { text, redacted, detectedPatterns } = redactSecrets(raw);
    expect(redacted).toBe(true);
    expect(detectedPatterns.length).toBeGreaterThan(0);
    expect(text).toContain(REDACTION_MARKER);
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(text).toContain('on region us-east-1');
  });

  it('redacts secrets recursively inside nested objects', () => {
    const data = {
      task: 'Deploy service',
      env: {
        AWS_KEY: 'AKIAIOSFODNN7EXAMPLE',
        PORT: 8080,
      },
      list: ['Normal text', 'Token: ghp_1234567890abcdef1234567890abcdef1234'],
    };

    const { data: sanitized, redactedPaths } = redactObject(data);
    expect(redactedPaths.length).toBeGreaterThanOrEqual(2);
    const sanitizedObj = sanitized as typeof data;
    expect(sanitizedObj.env.AWS_KEY).toContain(REDACTION_MARKER);
    expect(sanitizedObj.env.PORT).toBe(8080);
    expect(sanitizedObj.list[1]).toContain(REDACTION_MARKER);
  });
});
