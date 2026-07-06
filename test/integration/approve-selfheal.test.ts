import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadEndpoint } from './sveltekit-shim';

/**
 * #141 — Approve must not silently no-op on a stale consumed_by pointer.
 * A pointer at an EXISTING plan still short-circuits (duplicate guard, #115);
 * a pointer at a missing plan is self-healed: audit note + full approval,
 * with consumed_by overwritten by the newly created plan.
 */

function proposal(consumedBy: string | null): string {
  return [
    '---',
    'title: "Self-heal fixture"',
    'approved: true',
    'assigned_to: "NetYeti"',
    'author: NetYeti',
    'created: 2026-07-01',
    ...(consumedBy ? [`consumed_by: ${consumedBy}`] : []),
    '---',
    '',
    '## Summary',
    '',
    'A proposal used to exercise the approve flow.',
    '',
    '## Proposed Solution',
    '',
    '1. Do the thing',
    '',
  ].join('\n');
}

const USER = { displayName: 'Heal Tester', email: 'heal@example.com' };

describe('Approve consumed_by self-heal (#141)', function () {
  this.timeout(20000);
  let vault: string;
  let POST: any;
  const originalEnv = process.env.DOCWRIGHT_ROOT;
  // The approve endpoint calls the live OpenCode backend for plan generation
  // when OPENCODE_URL is set (no timeout) — hung the BDFL's in-UI Run Tests on
  // 2026-07-06. Tests must always take the deterministic template fallback.
  const originalOpencodeUrl = process.env.OPENCODE_URL;

  before(() => {
    delete process.env.OPENCODE_URL;
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'approve-heal-'));
    for (const d of ['proposals/approved', 'plans/completed', 'docs']) {
      fs.mkdirSync(path.join(vault, d), { recursive: true });
    }
    fs.writeFileSync(path.join(vault, '.gitignore'), '.docwright/\n');
    fs.writeFileSync(path.join(vault, 'proposals', 'stale.md'), proposal('plans/gone.md'));
    fs.writeFileSync(path.join(vault, 'proposals', 'linked.md'), proposal('plans/exists.md'));
    fs.writeFileSync(path.join(vault, 'plans', 'exists.md'), '---\ntitle: "Exists"\nstatus: draft\n---\n');
    execSync('git init -q -b main', { cwd: vault });
    execSync('git add -A && git -c user.name=Seed -c user.email=seed@example.com commit -qm "chore: seed"', { cwd: vault });
    process.env.DOCWRIGHT_ROOT = vault;
    ({ POST } = loadEndpoint('src/webui/src/routes/api/approve-proposal/+server'));
  });

  after(() => {
    if (originalEnv === undefined) delete process.env.DOCWRIGHT_ROOT;
    else process.env.DOCWRIGHT_ROOT = originalEnv;
    if (originalOpencodeUrl !== undefined) process.env.OPENCODE_URL = originalOpencodeUrl;
    fs.rmSync(vault, { recursive: true, force: true });
  });

  async function approve(p: string) {
    return POST({
      request: { json: async () => ({ path: p }) },
      locals: { user: USER },
    } as any);
  }

  it('valid consumed_by still short-circuits as alreadyExists (#115 guard intact)', async () => {
    const res = await approve('proposals/linked.md');
    const body = await res.json();
    assert.strictEqual(body.alreadyExists, true);
    assert.strictEqual(body.planPath, 'plans/exists.md');
    // Untouched: still in proposals/ root
    assert.ok(fs.existsSync(path.join(vault, 'proposals', 'linked.md')));
  });

  it('stale consumed_by is healed: approval proceeds and pointer is overwritten', async () => {
    const res = await approve('proposals/stale.md');
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    assert.strictEqual(body.ok, true);
    assert.notStrictEqual(body.alreadyExists, true, 'silently no-opped on stale pointer');

    // Full approval happened: moved + plan created + pointer healed
    assert.ok(!fs.existsSync(path.join(vault, 'proposals', 'stale.md')));
    const approved = fs.readFileSync(path.join(vault, 'proposals', 'approved', 'stale.md'), 'utf-8');
    assert.ok(approved.includes(`consumed_by: ${body.planPath}`), approved.match(/consumed_by:.*/)?.[0]);
    assert.ok(fs.existsSync(path.join(vault, body.planPath)));

    // Self-heal recorded in the audit log
    const audit = fs.readFileSync(path.join(vault, '.docwright', 'audit.jsonl'), 'utf-8');
    assert.ok(audit.includes('CONSUMED_BY_SELF_HEAL'), audit);
  });
});
