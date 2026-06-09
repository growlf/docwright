import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getSessionContext, listActivePlans, getPlan, getStatus } from '../../src/mcp/tools/query';
import { getFacts, collate, runDryRun, auditLog } from '../../src/mcp/tools/utility';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'query-vault');

describe('Query and Utility Tools', () => {
  before(() => {
    if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'proposals', 'approved'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'proposals', 'approved'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'plans', 'completed'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'plans', 'completed'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'docs', 'SOPs'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'docs', 'SOPs'), { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, '.docwright'))) fs.mkdirSync(path.join(FIXTURE_DIR, '.docwright'), { recursive: true });
    setRepoRoot(FIXTURE_DIR);
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
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'p1.md'), '---\ntitle: "P1"\n---\n');
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'active.md'), '---\nstatus: approved\ntitle: "Active"\n---\n');
    
    const res = await getStatus();
    assert.ok(res.includes('Proposals: 1 raw'));
    assert.ok(res.includes('Active Plans'));
    assert.ok(res.includes('Active'));
  });

  it('collate: finds overlapping documents', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'auth1.md'), 'Authentication setup for the system.');
    fs.writeFileSync(path.join(FIXTURE_DIR, 'proposals', 'auth2.md'), 'Authentication and login system.');
    
    const res = await collate(0.1);
    assert.ok(res.includes('Document Collation'));
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
