import assert from 'assert';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { commitPaths } from '../../src/webui/src/lib/server/git-commit';

const USER = { displayName: 'Dogfood User', email: 'dogfood@localhost' };

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-gitcommit-'));
  execSync('git init -q', { cwd: dir });
  // fresh init → no hooksPath, so governance hooks don't run in the test
  return dir;
}

describe('commitPaths (#110)', () => {
  it('stages the given paths and commits, returning a short SHA, leaving a clean tree', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'a.md'), '# a\n');
    const r = commitPaths(repo, { message: 'docs: add a', stagePaths: ['a.md'], user: USER });
    assert.ok(r.ok, 'commit should succeed');
    if (r.ok) assert.match(r.sha, /^[0-9a-f]{7,}$/);
    const status = execSync('git status --porcelain', { cwd: repo, encoding: 'utf-8' }).trim();
    assert.strictEqual(status, '', 'tree should be clean after commit');
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('authors the commit as the provided user', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'a.md'), '# a\n');
    commitPaths(repo, { message: 'docs: add a', stagePaths: ['a.md'], user: USER });
    const name = execSync('git log -1 --format=%an', { cwd: repo, encoding: 'utf-8' }).trim();
    const email = execSync('git log -1 --format=%ae', { cwd: repo, encoding: 'utf-8' }).trim();
    assert.strictEqual(name, 'Dogfood User');
    assert.strictEqual(email, 'dogfood@localhost');
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('stages deletions + additions for a move (git add -A -- paths)', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'old.md'), 'x\n');
    commitPaths(repo, { message: 'docs: seed', stagePaths: ['old.md'], user: USER });
    // simulate a move
    fs.mkdirSync(path.join(repo, 'sub'));
    fs.renameSync(path.join(repo, 'old.md'), path.join(repo, 'sub', 'new.md'));
    const r = commitPaths(repo, { message: 'docs: move', stagePaths: ['old.md', 'sub/new.md'], user: USER });
    assert.ok(r.ok);
    const status = execSync('git status --porcelain', { cwd: repo, encoding: 'utf-8' }).trim();
    assert.strictEqual(status, '', 'move fully committed');
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('returns a structured error (not a throw) when there is nothing to commit', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'a.md'), '# a\n');
    commitPaths(repo, { message: 'docs: add a', stagePaths: ['a.md'], user: USER });
    const r = commitPaths(repo, { message: 'docs: noop', stagePaths: [], user: USER });
    assert.ok(!r.ok);
    if (!r.ok) assert.match(r.error, /nothing to commit/i);
    fs.rmSync(repo, { recursive: true, force: true });
  });
});
