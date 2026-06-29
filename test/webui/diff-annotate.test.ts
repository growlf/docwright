/**
 * Tier 2 tests — Step 12
 *
 * Part A: diffAnnotate() — covered in test/dispatch/linter.test.ts (pure unit).
 *
 * Part B: Selective staging integration — exercises the git operations that
 * /api/git/stage and /api/git/restore perform against a real temp git repo.
 * Verifies that only accepted files are staged and rejected files are restored.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, it, before, after } from 'mocha';

// ── Git helper ────────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function write(dir: string, rel: string, content: string) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

// ── Path validation helper (mirrors endpoint logic) ───────────────────────────

function safePaths(repo: string, paths: string[]): string[] {
  return paths.filter(p => {
    if (path.isAbsolute(p)) return false;
    const abs = path.join(repo, p);
    return abs.startsWith(repo + path.sep);
  });
}

// ── Staging helpers (mirror /api/git/stage and /api/git/restore logic) ────────

function stageFiles(repo: string, paths: string[]): boolean {
  const safe = safePaths(repo, paths);
  if (safe.length === 0) return false;
  return git(['add', '--', ...safe], repo).ok;
}

function restoreFiles(repo: string, paths: string[]): boolean {
  const safe = safePaths(repo, paths);
  if (safe.length === 0) return true;
  return git(['checkout', 'HEAD', '--', ...safe], repo).ok;
}

function stagedFiles(repo: string): string[] {
  const r = git(['diff', '--name-only', '--cached'], repo);
  return r.stdout.split('\n').filter(Boolean);
}

function worktreeContent(repo: string, rel: string): string {
  return fs.readFileSync(path.join(repo, rel), 'utf-8');
}

// ── Test suite ────────────────────────────────────────────────────────────────

let REPO: string;

describe('Selective staging integration (Tier 2 Step 12)', () => {
  before(() => {
    REPO = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-stage-test-'));

    // Init bare repo with a commit
    git(['init', '-b', 'main'], REPO);
    git(['config', 'user.email', 'test@docwright.io'], REPO);
    git(['config', 'user.name', 'DocWright Test'], REPO);

    write(REPO, 'a.md', '---\nstatus: draft\n---\n\n# A\n');
    write(REPO, 'b.md', '---\nstatus: draft\n---\n\n# B\n');
    write(REPO, 'c.md', '---\nstatus: draft\n---\n\n# C\n');

    git(['add', '.'], REPO);
    git(['commit', '-m', 'init'], REPO);

    // Modify all three files (working tree changes — like a session diff)
    write(REPO, 'a.md', '---\nstatus: in-progress\n---\n\n# A updated\n');
    write(REPO, 'b.md', '---\nstatus: completed\n---\n\n# B updated\n');
    write(REPO, 'c.md', '---\nstatus: canceled\n---\n\n# C updated\n');
  });

  after(() => {
    fs.rmSync(REPO, { recursive: true, force: true });
  });

  it('stages only accepted files (a.md and b.md), skips c.md', () => {
    const accepted = ['a.md', 'b.md'];
    const ok = stageFiles(REPO, accepted);
    assert.ok(ok, 'git add should succeed');
    const staged = stagedFiles(REPO);
    assert.ok(staged.includes('a.md'), 'a.md should be staged');
    assert.ok(staged.includes('b.md'), 'b.md should be staged');
    assert.ok(!staged.includes('c.md'), 'c.md should NOT be staged');
  });

  it('restores rejected file (c.md) to HEAD content', () => {
    const rejected = ['c.md'];
    const ok = restoreFiles(REPO, rejected);
    assert.ok(ok, 'git checkout HEAD should succeed');
    const content = worktreeContent(REPO, 'c.md');
    assert.ok(content.includes('status: draft'), 'c.md should be restored to HEAD (draft)');
    assert.ok(!content.includes('status: canceled'), 'c.md should not have session change');
  });

  it('accepted files retain their session changes after restore', () => {
    assert.ok(worktreeContent(REPO, 'a.md').includes('status: in-progress'), 'a.md should still have session change');
    assert.ok(worktreeContent(REPO, 'b.md').includes('status: completed'), 'b.md should still have session change');
  });

  it('safePaths rejects paths that escape the repo root', () => {
    const bad = ['../etc/passwd', '../../secret', 'a.md'];
    const safe = safePaths(REPO, bad);
    assert.strictEqual(safe.length, 1);
    assert.strictEqual(safe[0], 'a.md');
  });

  it('safePaths rejects absolute paths', () => {
    const bad = ['/etc/passwd', '/tmp/evil', 'b.md'];
    const safe = safePaths(REPO, bad);
    assert.strictEqual(safe.length, 1);
    assert.strictEqual(safe[0], 'b.md');
  });

  it('staging with empty accepted list is a no-op', () => {
    const stagedBefore = stagedFiles(REPO);
    const result = stageFiles(REPO, []);
    assert.strictEqual(result, false, 'empty paths should return false without git call');
    const stagedAfter = stagedFiles(REPO);
    assert.deepEqual(stagedBefore, stagedAfter, 'staged set must not change');
  });

  it('restore with empty rejected list succeeds as no-op', () => {
    const result = restoreFiles(REPO, []);
    assert.strictEqual(result, true, 'empty reject list should return true');
  });
});
