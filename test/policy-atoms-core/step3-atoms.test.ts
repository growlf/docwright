/**
 * Step 3 atom tests — lifecycle-gate, no-plaintext-creds, no-secrets.
 * Side-by-side equivalence: atom check vs old-path TypeScript reimplementation.
 */
import assert from 'assert';
import * as path from 'node:path';
import { resolve } from '../../src/policy-atoms-core/resolver.js';
import type { CheckContext, CheckResult } from '../../src/policy-atoms-core/schema.js';

const POLICIES_DIR = path.resolve(process.cwd(), 'policies');

function ctx(overrides: Partial<CheckContext>): CheckContext {
  return { filePath: 'plans/test.md', frontmatter: {}, content: '', vaultRoot: process.cwd(), ...overrides };
}

async function atomCheck(id: string, context: CheckContext): Promise<CheckResult> {
  const { atoms, errors } = await resolve([id], { policiesDir: POLICIES_DIR });
  if (errors.length) throw new Error(`resolve: ${JSON.stringify(errors)}`);
  if (!atoms[0].check) throw new Error(`atom ${id} has no check.js`);
  return atoms[0].check(context);
}

// ---------------------------------------------------------------------------
// Old-path reimplementations
// ---------------------------------------------------------------------------

function oldPath_lifecycleGate(fm: Record<string, unknown>): boolean {
  const status = fm['status'] as string | undefined;
  const gate   = fm['gate_status'] as string | undefined;
  if (gate === 'approved' || gate === 'waived') return false;
  if (status === 'completed') {
    const d = fm['completed_date'] as string | undefined;
    return !!(d && d.trim());
  }
  if (status === 'canceled') {
    const cd = fm['canceled_date'] as string | undefined;
    const cr = fm['cancellation_reason'] as string | undefined;
    return !!(cd && cd.trim()) && !!(cr && cr.trim());
  }
  return true;
}

const CRED_RE = [
  /\bpassword\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer|set in|from)\b)[^\s"'<]{4,}/i,
  /\bsecret\s*[:=]\s*(?!['"]?(vault|bitwarden|<|stored|see|refer)\b)[^\s"'<]{6,}/i,
  /\b(?:api[_-]?key|apikey)\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see))[^\s"'<]{8,}/i,
  /\btoken\s*[:=]\s*(?!['"]?(?:vault|bitwarden|<|stored|see|\$))[a-zA-Z0-9_\-\.]{12,}/i,
];
function oldPath_noPlaintextCreds(content: string): boolean {
  return !CRED_RE.some(re => re.test(content));
}

const SECRET_RE = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:ghp|gho|ghs|ghr|github_pat)_[a-zA-Z0-9]{36,}/,
  /sk-(?:proj-)?[a-zA-Z0-9]{32,}/,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
  /(?:aws|AKIA)[A-Z0-9]{16}/,
];
function oldPath_noSecrets(content: string): boolean {
  return !SECRET_RE.some(re => re.test(content));
}

// ---------------------------------------------------------------------------
// lifecycle-gate equivalence
// ---------------------------------------------------------------------------

describe('Step 3 atom / lifecycle-gate (side-by-side)', () => {
  const cases: Array<{ fm: Record<string, unknown>; desc: string }> = [
    { fm: { status: 'completed', completed_date: '2026-06-17' }, desc: 'completed with date' },
    { fm: { status: 'completed', completed_date: '' },           desc: 'completed no date' },
    { fm: { status: 'completed', completed_date: '   ' },        desc: 'completed whitespace date' },
    { fm: { status: 'canceled', canceled_date: '2026-06-17', cancellation_reason: 'Superseded' }, desc: 'canceled with all fields' },
    { fm: { status: 'canceled', canceled_date: '2026-06-17', cancellation_reason: '' }, desc: 'canceled missing reason' },
    { fm: { status: 'canceled', canceled_date: '', cancellation_reason: 'Reason' }, desc: 'canceled missing date' },
    { fm: { status: 'draft' },                                   desc: 'draft — no fields required' },
    { fm: { status: 'in-progress', assigned_to: 'NetYeti' },     desc: 'in-progress — no gate fields' },
    { fm: { status: 'approved', gate_status: 'approved' },       desc: 'gate_status approved — blocked' },
    { fm: { status: 'approved', gate_status: 'waived' },         desc: 'gate_status waived — blocked' },
    { fm: { status: 'approved', gate_status: 'pending' },        desc: 'gate_status pending — ok' },
  ];

  for (const { fm, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult = await atomCheck('lifecycle-gate', ctx({ frontmatter: fm }));
      const oldPass    = oldPath_lifecycleGate(fm);
      assert.strictEqual(atomResult.pass, oldPass, `divergence: atom=${atomResult.pass} old=${oldPass} msg="${atomResult.message}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// no-plaintext-creds equivalence
// ---------------------------------------------------------------------------

describe('Step 3 atom / no-plaintext-creds (side-by-side)', () => {
  const cases: Array<{ content: string; desc: string }> = [
    { content: 'password: admin123',                        desc: 'plaintext password' },
    { content: 'password: stored in Bitwarden',            desc: 'vault reference — ok' },
    { content: 'token: ghp_abc123def456ghi789jkl012mno', desc: 'plaintext token' },
    { content: 'token: $GITHUB_TOKEN',                     desc: 'env var reference — ok' },
    { content: 'apikey: secretkey12345678',                desc: 'plaintext api key' },
    { content: 'api_key: <bitwarden:my-api-key>',          desc: 'placeholder — ok' },
    { content: 'secret: mysecretvalue',                    desc: 'plaintext secret' },
    { content: 'secret: see Bitwarden for value',          desc: 'vault reference — ok' },
    { content: 'No credentials here at all.',              desc: 'clean content' },
    { content: 'password: see vault for details',          desc: 'see vault — ok' },
  ];

  for (const { content, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult = await atomCheck('no-plaintext-creds', ctx({ content }));
      const oldPass    = oldPath_noPlaintextCreds(content);
      assert.strictEqual(atomResult.pass, oldPass, `divergence: atom=${atomResult.pass} old=${oldPass} msg="${atomResult.message}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// no-secrets equivalence
// ---------------------------------------------------------------------------

describe('Step 3 atom / no-secrets (side-by-side)', () => {
  const cases: Array<{ content: string; desc: string }> = [
    { content: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n-----END OPENSSH PRIVATE KEY-----', desc: 'SSH private key' },
    { content: 'ghp_' + 'a'.repeat(36),                   desc: 'GitHub PAT' },
    { content: 'sk-proj-' + 'a'.repeat(32),               desc: 'OpenAI API key' },
    { content: 'AKIAIOSFODNN7EXAMPLE',                    desc: 'AWS access key' },
    { content: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', desc: 'JWT token' },
    { content: 'API_KEY=$(bw get password my-key)',        desc: 'vault CLI lookup — ok' },
    { content: 'No secrets here, just documentation.',    desc: 'clean content' },
    { content: 'See Bitwarden for the SSH key.',          desc: 'vault reference — ok' },
  ];

  for (const { content, desc } of cases) {
    it(`"${desc}" — atom agrees with old-path`, async () => {
      const atomResult = await atomCheck('no-secrets', ctx({ content }));
      const oldPass    = oldPath_noSecrets(content);
      assert.strictEqual(atomResult.pass, oldPass, `divergence: atom=${atomResult.pass} old=${oldPass} msg="${atomResult.message}"`);
    });
  }
});
