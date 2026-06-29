import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getSessionContext, listActivePlans, getPlan, getStatus, resetStatusCache } from '../../src/mcp/tools/query';
import { getFacts, collate, runDryRun, auditLog } from '../../src/mcp/tools/utility';
import { setRepoRoot } from '../../src/mcp/lib/paths';
import { planOverlapReport } from '../../src/mcp/lib/collate';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'query-vault');

describe('Query and Utility Tools', () => {
  before(() => {
    if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'proposals', 'approved'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'proposals', 'approved'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'plans', 'completed'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'plans', 'completed'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'docs', 'SOPs'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'docs', 'SOPs'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, '.docwright'))) fs.mkdirSync(path.join(FIXTURE_DIR, '.docwright'), { recursive: true });
  });

  beforeEach(() => {
    setRepoRoot(FIXTURE_DIR);
    resetStatusCache();
  });

  afterEach(() => {
    // cleanup
    ['proposals', 'proposals/approved', 'plans', 'plans/completed', 'docs', 'docs/SOPs', '.docwright'].forEach(dir => {
      const full = path.join(FIXTURE_DIR, dir);
      if (fs.existsSync(full)) {
        fs.readdirSync(full).filter(f => f.endsWith('.md') || f.endsWith('.jsonl')).forEach(f => fs.unlinkSync(path.join(full, f)));
      }
    });
    if (fs.existsSync(path.join(FIXTURE_DIR, 'SESSION-LOG.md'))) fs.unlinkSync(path.join(FIXTURE_DIR, 'SESSION-LOG.md'));
  });

  it('get_session_context: reads SESSION-LOG.md and active plans', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'SESSION-LOG.md'), 'log line 1\nlog line 2');
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'active.md'), '---\nstatus: approved\ntitle: "Active Plan"\n---\n');
    
    const res = await getSessionContext();
    assert.ok(res.includes('log line 1'));
    assert.ok(res.includes('Active Plan'));
  });

  it('get_plan: reads from plans/ and adds footer', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'Plan content');
    const res = await getPlan('test');
    assert.ok(res.includes('Plan content'));
    assert.ok(res.includes('⚠ **Governance:**'));
  });

  it('get_status: builds a vault summary', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'p1.md'), '---\ntitle: "P1"\nstatus: false\n---\n');
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'active.md'), '---\nstatus: approved\ntitle: "Active"\n---\n');
    
    const res = await getStatus();
    assert.ok(res.includes('LIFECYCLE DOCUMENT STATUS'));
    assert.ok(res.includes('PROPOSALS (proposals/)'));
    assert.ok(res.includes('PLANS (plans/)'));
    assert.ok(res.includes('p1.md'));
  });

  it('collate: finds overlapping documents', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'auth1.md'), 'Authentication setup for the system.');
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'auth2.md'), 'Authentication and login system.');
    
    const res = await collate(0.1);
    assert.ok(res.includes('Overlap analysis'));
    assert.ok(res.includes('auth1.md'));
    assert.ok(res.includes('auth2.md'));
  });

  it('run_dry_run: detects ready transitions', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'ready.md'), '---\napproved: true\nassigned_to: "NetYeti"\n---\n');
    const res = await runDryRun();
    assert.ok(res.includes('[READY TO APPROVE]  ready'));
  });

  it('audit_log: reads from audit.jsonl', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, '.docwright', 'audit.jsonl'), JSON.stringify({ ts: '2026-06-09T12:00:00Z', event: 'TEST', details: 'info' }) + '\n');
    const res = await auditLog();
    assert.ok(res.includes('2026-06-09'));
    assert.ok(res.includes('TEST'));
  });
});

describe('planOverlapReport', () => {
  it('returns pairs above threshold for overlapping in-progress vs approved plans', () => {
    const docs = [
      {
        name: 'auth-refactor.md',
        status: 'in-progress',
        text: 'Authentication system refactor. Migrate session tokens to HttpOnly cookies. Update login flow and logout handler. Security audit of authentication middleware.',
      },
      {
        name: 'auth-middleware.md',
        status: 'approved',
        text: 'Authentication middleware overhaul. Replace session token storage. HttpOnly cookie migration. Login and logout flow security review.',
      },
      {
        name: 'unrelated.md',
        status: 'approved',
        text: 'Completely different topic about database schema migration and indexing strategy.',
      },
    ];

    const pairs = planOverlapReport(docs, 0.1);
    assert.ok(pairs.length >= 1, `Expected at least one overlap pair, got ${pairs.length}`);
    const pair = pairs[0];
    assert.strictEqual(pair.planA, 'auth-refactor.md');
    assert.strictEqual(pair.planB, 'auth-middleware.md');
    assert.ok(pair.score >= 0.1, `Score ${pair.score} should be >= 0.1`);
  });

  it('returns empty when no plans overlap above threshold', () => {
    const docs = [
      { name: 'alpha.md', status: 'in-progress', text: 'WebSocket integration and real-time push notifications.' },
      { name: 'beta.md',  status: 'approved',    text: 'Database indexing strategy for large table scans.' },
    ];
    const pairs = planOverlapReport(docs, 0.12);
    assert.strictEqual(pairs.length, 0);
  });

  it('ignores pairs where both plans are approved (no in-progress)', () => {
    const docs = [
      { name: 'a.md', status: 'approved', text: 'Authentication session token migration HttpOnly cookies login.' },
      { name: 'b.md', status: 'approved', text: 'Authentication session token migration HttpOnly cookies login.' },
    ];
    const pairs = planOverlapReport(docs, 0.1);
    assert.strictEqual(pairs.length, 0, 'Should not flag approved-vs-approved pairs');
  });
});
