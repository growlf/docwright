import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { setRepoRoot, getRepoRoot } from '../../src/mcp/lib/paths';
import { transitionToCompleted } from '../../src/mcp/tools/transitions';
import { generateCompletionDoc } from '../../src/dispatch/completion-doc';
import { loadEndpoint } from './sveltekit-shim';

/**
 * #147/#142 — Web UI lifecycle writes must commit (working tree never left
 * dirty) and the completion doc must be the shared dispatch generator's
 * output, byte-identical across the MCP and Web UI surfaces.
 */

// Passes the full completion gate, so the transition succeeds end to end.
const PASSING_PLAN = `---
title: Commit fixture plan
status: completed
tests_defined: true
tests_human_reviewed: true
tests_last_result: pass
author: Fixture Author
created: 2026-07-01
tags:
  - alpha
  - beta
---

# Commit fixture plan

## Implementation Steps

| # | Step | Action | Status |
|---|------|--------|--------|
| 1 | Only step | Do the thing | ✅ Done |

## Testing Plan

- [x] Verified thing

### Gate Criteria

- [x] Gate met

## Document History

| Date | Change | Author |
|------|--------|--------|
`;

const USER = { displayName: 'Commit Tester', email: 'commit@example.com' };

function makeVault(prefix: string, withGit: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const d of ['plans/completed', 'docs']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plans', 'commit-fixture.md'), PASSING_PLAN);
  // Mirror the real vault: .docwright/ runtime artifacts (write-audit.jsonl
  // from moveDocument, etc.) are gitignored.
  fs.writeFileSync(path.join(dir, '.gitignore'), '.docwright/\n');
  if (withGit) {
    execSync('git init -q -b main', { cwd: dir });
    execSync('git add -A && git -c user.name=Seed -c user.email=seed@example.com commit -qm "chore: seed fixture"', { cwd: dir });
  }
  return dir;
}

function git(dir: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: dir, encoding: 'utf-8' }).trim();
}

describe('Web UI lifecycle writes auto-commit (#147) + shared completion doc (#142)', function () {
  this.timeout(20000);
  const originalRoot = getRepoRoot();
  const originalEnv = process.env.DOCWRIGHT_ROOT;
  const cleanupDirs: string[] = [];

  after(() => {
    setRepoRoot(originalRoot);
    if (originalEnv === undefined) delete process.env.DOCWRIGHT_ROOT;
    else process.env.DOCWRIGHT_ROOT = originalEnv;
    for (const d of cleanupDirs) fs.rmSync(d, { recursive: true, force: true });
  });

  it('transition-completed archives, generates the shared doc, and commits — tree left clean', async () => {
    const vault = makeVault('webui-commit-', true);
    cleanupDirs.push(vault);
    process.env.DOCWRIGHT_ROOT = vault;
    const { POST } = loadEndpoint('src/webui/src/routes/api/lifecycle/transition-completed/+server');

    const res = await POST({
      request: { json: async () => ({ plan: 'commit-fixture' }) },
      locals: { user: USER },
    } as any);
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));

    // Archived + doc generated
    assert.ok(!fs.existsSync(path.join(vault, 'plans', 'commit-fixture.md')));
    assert.ok(fs.existsSync(path.join(vault, 'plans', 'completed', 'commit-fixture.md')));
    const doc = fs.readFileSync(path.join(vault, 'docs', 'commit-fixture.md'), 'utf-8');

    // Doc is the shared dispatch generator's output (fresh minimal
    // frontmatter — no quote-wrapped re-serialization, tags as a block list)
    const archived = fs.readFileSync(path.join(vault, 'plans', 'completed', 'commit-fixture.md'), 'utf-8');
    const today = new Date().toISOString().slice(0, 10);
    assert.strictEqual(doc, generateCompletionDoc(archived, 'commit-fixture.md', today));
    assert.ok(doc.includes('tags:\n  - alpha\n  - beta'));

    // Committed as the authenticated user; nothing left dirty
    assert.ok(body.committed, `commit failed: ${body.commitError}`);
    assert.strictEqual(body.commitError, null);
    assert.strictEqual(git(vault, 'status --porcelain'), '');
    assert.strictEqual(git(vault, 'log -1 --format=%an,%ae'), 'Commit Tester,commit@example.com');
    assert.match(git(vault, 'log -1 --format=%s'), /^docs: complete commit-fixture/);
  });

  it('webui completion doc is byte-identical to the MCP surface for the same plan', async () => {
    const mcpVault = makeVault('mcp-doc-', false);
    cleanupDirs.push(mcpVault);
    setRepoRoot(mcpVault);
    const mcpMsg = await transitionToCompleted('commit-fixture');
    assert.ok(mcpMsg.startsWith('✅'), mcpMsg);
    const mcpDoc = fs.readFileSync(path.join(mcpVault, 'docs', 'commit-fixture.md'), 'utf-8');

    const webuiVault = makeVault('webui-doc-', true);
    cleanupDirs.push(webuiVault);
    process.env.DOCWRIGHT_ROOT = webuiVault;
    const { POST } = loadEndpoint('src/webui/src/routes/api/lifecycle/transition-completed/+server');
    const res = await POST({
      request: { json: async () => ({ plan: 'commit-fixture' }) },
      locals: { user: USER },
    } as any);
    assert.strictEqual(res.status, 200);
    const webuiDoc = fs.readFileSync(path.join(webuiVault, 'docs', 'commit-fixture.md'), 'utf-8');

    assert.strictEqual(webuiDoc, mcpDoc);
  });

  it('/api/write commits the saved file — tree left clean', async () => {
    const vault = makeVault('webui-write-', true);
    cleanupDirs.push(vault);
    process.env.DOCWRIGHT_ROOT = vault;
    const { POST } = loadEndpoint('src/webui/src/routes/api/write/+server');

    const res = await POST({
      url: new URL('http://localhost/api/write?path=notes.md'),
      request: {
        json: async () => ({ content: '# Notes\n\nSaved from the web ui.\n' }),
        headers: { get: () => null },
      },
      locals: { user: USER },
    } as any);
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));

    assert.ok(body.committed, `commit failed: ${body.commitError}`);
    assert.strictEqual(git(vault, 'status --porcelain'), '');
    assert.strictEqual(git(vault, 'log -1 --format=%an,%ae'), 'Commit Tester,commit@example.com');
    assert.match(git(vault, 'log -1 --format=%s'), /^docs: edit notes\.md/);
  });
});
