import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveACL, canPerform } from '../../src/dispatch/acl';

function makeVault(contributors: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-acl-'));
  const dir  = path.join(root, '.docwright');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'contributors.json'), JSON.stringify(contributors));
  return root;
}

describe('ACL controller', () => {
  it('resolves correct tier from contributors.json', () => {
    const root = makeVault({ alice: 'steward', bob: 'observer' });
    assert.strictEqual(resolveACL(root, 'alice').tier, 'steward');
    assert.strictEqual(resolveACL(root, 'bob').tier, 'observer');
    fs.rmSync(root, { recursive: true });
  });

  it('defaults to contributor when user not in contributors.json', () => {
    const root = makeVault({ alice: 'governance' });
    assert.strictEqual(resolveACL(root, 'unknown').tier, 'contributor');
    fs.rmSync(root, { recursive: true });
  });

  it('defaults to contributor when contributors.json missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-acl-no-'));
    assert.strictEqual(resolveACL(root, 'anyone').tier, 'contributor');
    fs.rmdirSync(root);
  });

  it('canPerform: observer can read but not write', () => {
    const ctx = { user: 'eve', tier: 'observer' as const };
    assert.strictEqual(canPerform(ctx, 'read',  'proposals/foo.md'), true);
    assert.strictEqual(canPerform(ctx, 'write', 'proposals/foo.md'), false);
  });

  it('canPerform: contributor can read and write but not approve', () => {
    const ctx = { user: 'dev', tier: 'contributor' as const };
    assert.strictEqual(canPerform(ctx, 'read',    'plans/x.md'), true);
    assert.strictEqual(canPerform(ctx, 'write',   'plans/x.md'), true);
    assert.strictEqual(canPerform(ctx, 'approve', 'plans/x.md'), false);
  });

  it('canPerform: steward can approve', () => {
    const ctx = { user: 'lead', tier: 'steward' as const };
    assert.strictEqual(canPerform(ctx, 'approve', 'proposals/y.md'), true);
    assert.strictEqual(canPerform(ctx, 'govern',  'policies/z.md'), false);
  });

  it('canPerform: governance can do everything', () => {
    const ctx = { user: 'admin', tier: 'governance' as const };
    assert.strictEqual(canPerform(ctx, 'read',    'any.md'), true);
    assert.strictEqual(canPerform(ctx, 'approve', 'any.md'), true);
    assert.strictEqual(canPerform(ctx, 'govern',  'any.md'), true);
  });

  it('canPerform returns false for unknown action', () => {
    const ctx = { user: 'x', tier: 'governance' as const };
    assert.strictEqual(canPerform(ctx, 'teleport', 'any.md'), false);
  });
});
