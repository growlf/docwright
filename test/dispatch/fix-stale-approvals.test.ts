import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const SCRIPT = path.resolve('scripts/fix-stale-approvals.ts');

function makeTmpVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-fix-approvals-'));
  fs.mkdirSync(path.join(dir, 'proposals', 'approved'), { recursive: true });
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email "test@test.com"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  return dir;
}

function writeProposal(dir: string, name: string, approved: boolean): string {
  const p = path.join(dir, 'proposals', name);
  fs.writeFileSync(p, `---\ntitle: "Test"\napproved: ${approved}\n_path: proposals/${name}\n---\n\nBody.\n`);
  return p;
}

function run(dir: string, args = ''): { out: string; code: number } {
  try {
    const out = execSync(
      `npx tsx "${SCRIPT}" ${args}`,
      { cwd: dir, encoding: 'utf-8', env: { ...process.env } }
    );
    return { out, code: 0 };
  } catch (e: any) {
    return { out: e.stdout ?? '', code: e.status ?? 1 };
  }
}

describe('fix-stale-approvals', () => {
  it('dry-run: lists stale file, does not move it', () => {
    const dir = makeTmpVault();
    writeProposal(dir, 'stale.md', true);
    const { out } = run(dir);
    assert.match(out, /\[dry-run\].*stale\.md/);
    assert.ok(fs.existsSync(path.join(dir, 'proposals', 'stale.md')), 'file must still be in proposals/');
    assert.ok(!fs.existsSync(path.join(dir, 'proposals', 'approved', 'stale.md')), 'file must not be in approved/');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('--fix: moves file and updates _path', () => {
    const dir = makeTmpVault();
    writeProposal(dir, 'move-me.md', true);
    execSync('git add .', { cwd: dir });
    execSync('git commit -q -m "init"', { cwd: dir });
    run(dir, '--fix');
    const dest = path.join(dir, 'proposals', 'approved', 'move-me.md');
    assert.ok(fs.existsSync(dest), 'file must be in proposals/approved/');
    assert.ok(!fs.existsSync(path.join(dir, 'proposals', 'move-me.md')), 'file must not remain in proposals/');
    const content = fs.readFileSync(dest, 'utf-8');
    assert.match(content, /_path: proposals\/approved\/move-me\.md/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips files already in proposals/approved/', () => {
    const dir = makeTmpVault();
    const already = path.join(dir, 'proposals', 'approved', 'already.md');
    fs.writeFileSync(already, `---\ntitle: "Already"\napproved: true\n_path: proposals/approved/already.md\n---\n`);
    const { out } = run(dir);
    assert.match(out, /No stale approved proposals found/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('idempotent: running --fix twice yields same result', () => {
    const dir = makeTmpVault();
    writeProposal(dir, 'idem.md', true);
    execSync('git add .', { cwd: dir });
    execSync('git commit -q -m "init"', { cwd: dir });
    run(dir, '--fix');
    execSync('git add .', { cwd: dir });
    execSync('git commit -q -m "after first fix"', { cwd: dir });
    const { out } = run(dir, '--fix');
    assert.match(out, /No stale approved proposals found/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('unapproved proposals are not touched', () => {
    const dir = makeTmpVault();
    writeProposal(dir, 'draft.md', false);
    const { out } = run(dir);
    assert.match(out, /No stale approved proposals found/);
    assert.ok(fs.existsSync(path.join(dir, 'proposals', 'draft.md')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
