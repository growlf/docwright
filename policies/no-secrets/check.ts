/**
 * no-secrets check — canonical TypeScript source.
 * Scans commit content for high-confidence secret patterns (keys, tokens, private key blocks).
 * Complementary to no-plaintext-creds; focuses on well-known secret formats.
 */
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'SSH/TLS private key block' },
  { pattern: /(?:ghp|gho|ghs|ghr|github_pat)_[a-zA-Z0-9]{36,}/, label: 'GitHub token' },
  { pattern: /sk-(?:proj-)?[a-zA-Z0-9]{32,}/, label: 'OpenAI/service API key' },
  { pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/, label: 'JWT token' },
  { pattern: /(?:aws|AKIA)[A-Z0-9]{16}/, label: 'AWS access key' },
];

export function check(ctx: CheckContext): CheckResult {
  const text = ctx.content;
  for (const { pattern, label } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return {
        pass: false,
        message: `${label} detected in content — never commit secrets; use Bitwarden references or environment variables`,
        atom_id: 'no-secrets',
      };
    }
  }
  return { pass: true, message: 'no known secret patterns detected', atom_id: 'no-secrets' };
}
