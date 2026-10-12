/**
 * ContextBridge — Secret Redaction
 *
 * Detects and redacts likely secrets from text content before persistence
 * or export. This is a best-effort defense-in-depth measure.
 *
 * IMPORTANT LIMITATION: Secret detection uses heuristic pattern matching.
 * It is not guaranteed to detect every secret, and it may produce false
 * positives. Never rely solely on this module to protect sensitive data.
 * The primary defense is the exclusion system (see exclusions.ts).
 */

// ---------------------------------------------------------------------------
// Secret patterns
// ---------------------------------------------------------------------------

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  /** Replacement string or function — use REDACTED marker */
  replacement: string | ((match: string, ...args: string[]) => string);
  /** Severity for reporting */
  severity: 'high' | 'medium';
}

export const REDACTION_MARKER = '[REDACTED by ContextBridge]';

/**
 * Heuristic patterns for common secret formats.
 * Patterns are ordered from most to least specific to minimize false positives.
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  // AWS Access Key ID
  {
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/g,
    replacement: REDACTION_MARKER,
    severity: 'high',
  },
  // AWS Secret Access Key (heuristic: 40 base64-like chars after keyword)
  {
    name: 'AWS Secret Key',
    pattern:
      /(?:aws[_\-.]?secret[_\-.]?(?:access[_\-.]?)?key|AWS_SECRET)\s*[=:]\s*["']?([A-Za-z0-9/+]{40})["']?/gi,
    replacement: `aws_secret_key: ${REDACTION_MARKER}`,
    severity: 'high',
  },
  // Generic API key patterns (key = "...")
  {
    name: 'API Key assignment',
    pattern: /(?:api[_\-.]?key|apikey|api[_\-.]?token)\s*[=:]\s*["']([^"'\n]{8,128})["']/gi,
    replacement: `api_key: ${REDACTION_MARKER}`,
    severity: 'high',
  },
  // Generic password assignment
  {
    name: 'Password assignment',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']([^"'\n]{4,256})["']/gi,
    replacement: `password: ${REDACTION_MARKER}`,
    severity: 'high',
  },
  // Generic secret/token assignment
  {
    name: 'Secret/token assignment',
    pattern: /(?:secret|token|auth)\s*[=:]\s*["']([^"'\n]{8,256})["']/gi,
    replacement: `secret: ${REDACTION_MARKER}`,
    severity: 'medium',
  },
  // Private key headers
  {
    name: 'Private key',
    pattern:
      /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|DSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|OPENSSH\s+|DSA\s+)?PRIVATE KEY-----/gi,
    replacement: `${REDACTION_MARKER} (private key removed)`,
    severity: 'high',
  },
  // GitHub tokens
  {
    name: 'GitHub Personal Access Token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
    replacement: REDACTION_MARKER,
    severity: 'high',
  },
  // GitHub OAuth/App tokens
  {
    name: 'GitHub Token',
    pattern: /\b(?:gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g,
    replacement: REDACTION_MARKER,
    severity: 'high',
  },
  // Slack tokens
  {
    name: 'Slack Token',
    pattern: /\bxox[boaprs]-(?:\d+-)+[a-zA-Z0-9-]+\b/g,
    replacement: REDACTION_MARKER,
    severity: 'high',
  },
  // Connection strings with passwords
  {
    name: 'Database connection string',
    pattern: /(?:mongodb|postgres|postgresql|mysql|redis|amqp|amqps):\/\/[^:]+:([^@\s]+)@/gi,
    replacement: (match: string) => match.replace(/:([^@\s]+)@/, `:${REDACTION_MARKER}@`),
    severity: 'high',
  },
  // Bearer tokens in HTTP headers
  {
    name: 'Bearer token',
    pattern: /Authorization:\s*Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
    replacement: `Authorization: Bearer ${REDACTION_MARKER}`,
    severity: 'high',
  },
  // Generic high-entropy strings that look like secrets (long base64)
  // Only in key=value context to reduce false positives
  {
    name: 'High-entropy credential value',
    pattern: /(?:key|secret|token|auth|credential|pass)\s*[=:]\s*([A-Za-z0-9+/]{32,}={0,2})\b/gi,
    replacement: `credential: ${REDACTION_MARKER}`,
    severity: 'medium',
  },
];

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export interface DetectionResult {
  found: boolean;
  matches: {
    patternName: string;
    severity: 'high' | 'medium';
  }[];
}

export interface RedactionResult {
  text: string;
  redacted: boolean;
  redactedCount: number;
  detectedPatterns: string[];
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Scan text for likely secrets without redacting.
 * Returns information about what was detected.
 */
export function detectSecrets(text: string): DetectionResult {
  const matches: { patternName: string; severity: 'high' | 'medium' }[] = [];

  for (const sp of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes
    const regex = new RegExp(sp.pattern.source, sp.pattern.flags);
    if (regex.test(text)) {
      matches.push({ patternName: sp.name, severity: sp.severity });
    }
  }

  return {
    found: matches.length > 0,
    matches,
  };
}

/**
 * Redact likely secrets from text, replacing them with the REDACTION_MARKER.
 * Returns the redacted text and information about what was redacted.
 */
export function redactSecrets(text: string): RedactionResult {
  let result = text;
  let redactedCount = 0;
  const detectedPatterns: string[] = [];

  for (const sp of SECRET_PATTERNS) {
    const regex = new RegExp(sp.pattern.source, sp.pattern.flags);
    const before = result;

    const repl = sp.replacement;
    if (typeof repl === 'function') {
      result = result.replace(regex, repl);
    } else {
      result = result.replace(regex, repl);
    }

    if (result !== before) {
      redactedCount++;
      detectedPatterns.push(sp.name);
    }
  }

  return {
    text: result,
    redacted: redactedCount > 0,
    redactedCount,
    detectedPatterns,
  };
}

/**
 * Apply redaction to all string values in an object recursively.
 * Returns the sanitized object and a list of fields that were redacted.
 */
export function redactObject(
  obj: unknown,
  path: string[] = [],
): { data: unknown; redactedPaths: string[] } {
  const redactedPaths: string[] = [];

  function recurse(value: unknown, currentPath: string[]): unknown {
    if (typeof value === 'string') {
      const result = redactSecrets(value);
      if (result.redacted) {
        redactedPaths.push(currentPath.join('.'));
        return result.text;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, i) => recurse(item, [...currentPath, String(i)]));
    }

    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = recurse(v, [...currentPath, k]);
      }
      return out;
    }

    return value;
  }

  return {
    data: recurse(obj, path),
    redactedPaths,
  };
}
