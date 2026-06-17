/**
 * no-plaintext-creds check — canonical TypeScript source.
 * Scans document content for plaintext credential patterns.
 * These patterns are heuristic — low false-negative bias (prefer to flag than miss).
 */
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

// Patterns that strongly suggest plaintext credentials in document content
const CRED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bpassword\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer|set in|from)\b)[^\s"'<]{4,}/i, label: 'plaintext password' },
  { pattern: /\bsecret\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer)\b)[^\s"'<]{6,}/i, label: 'plaintext secret' },
  { pattern: /\b(?:api[_-]?key|apikey)\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see))[^\s"'<]{8,}/i, label: 'plaintext API key' },
  { pattern: /\btoken\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see|\$))[a-zA-Z0-9_\-\.]{12,}/i, label: 'plaintext token' },
];

export function check(ctx: CheckContext): CheckResult {
  const text = ctx.content;
  for (const { pattern, label } of CRED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        pass: false,
        message: `possible ${label} detected in content — use a vault reference (e.g., "Bitwarden: item-name") instead of plaintext`,
        atom_id: 'no-plaintext-creds',
      };
    }
  }
  return { pass: true, message: 'no plaintext credential patterns detected', atom_id: 'no-plaintext-creds' };
}
