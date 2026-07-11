import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  setRepoRoot, readFile, writeFile, fileExists, getMtime, globFiles, moveFile,
} from '../../src/mcp/lib/paths';

// Regression tests for the path-traversal fix in src/mcp/lib/paths.ts:
//  - prefix-based containment (startsWith) admitted a sibling dir sharing the
//    root's name (root /x/DocWright admitting /x/DocWright-evil);
//  - fileExists/getMtime/globFiles had NO containment check at all.
describe('mcp/lib/paths containment', () => {
  let tmpRoot: string;
  let vault: string;
  let sibling: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-paths-'));
    vault = path.join(tmpRoot, 'DocWright');            // the vault root
    sibling = path.join(tmpRoot, 'DocWright-evil');      // shares the name PREFIX
    fs.mkdirSync(vault, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, 'secret.txt'), 'TOP SECRET', 'utf8');
    setRepoRoot(vault);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    setRepoRoot('');
  });

  it('allows normal in-vault read/write/exists/mtime/glob/move', () => {
    writeFile('notes/a.md', '# A');
    assert.strictEqual(readFile('notes/a.md'), '# A');
    assert.strictEqual(fileExists('notes/a.md'), true);
    assert.strictEqual(fileExists('notes/missing.md'), false);
    assert.ok(getMtime('notes/a.md') > 0);
    assert.deepStrictEqual(globFiles('notes'), ['notes/a.md']);
    moveFile('notes/a.md', 'archive/a.md');
    assert.strictEqual(fileExists('archive/a.md'), true);
    assert.strictEqual(fileExists('notes/a.md'), false);
  });

  it('BLOCKS the sibling-prefix bypass (root name is a prefix of a sibling dir)', () => {
    // The core CVE: /tmp/x/DocWright-evil/secret.txt startsWith /tmp/x/DocWright
    assert.throws(() => readFile('../DocWright-evil/secret.txt'), /Access denied/);
    assert.throws(() => writeFile('../DocWright-evil/pwn.txt', 'x'), /Access denied/);
    assert.throws(() => fileExists('../DocWright-evil/secret.txt'), /Access denied/);
    assert.throws(() => getMtime('../DocWright-evil/secret.txt'), /Access denied/);
    assert.throws(() => globFiles('../DocWright-evil'), /Access denied/);
    assert.throws(() => moveFile('../DocWright-evil/secret.txt', 'stolen.txt'), /Access denied/);
    assert.throws(() => moveFile('notes/a.md', '../DocWright-evil/out.txt'), /Access denied/);
    // sibling file must be untouched
    assert.strictEqual(fs.readFileSync(path.join(sibling, 'secret.txt'), 'utf8'), 'TOP SECRET');
  });

  it('BLOCKS dot-dot traversal in every helper (incl. the previously-unchecked ones)', () => {
    assert.throws(() => readFile('../../../../etc/passwd'), /Access denied/);
    assert.throws(() => writeFile('../../evil.txt', 'x'), /Access denied/);
    assert.throws(() => fileExists('../../../../etc/passwd'), /Access denied/);   // existence oracle
    assert.throws(() => getMtime('../../../../etc/passwd'), /Access denied/);     // mtime oracle
    assert.throws(() => globFiles('../..'), /Access denied/);                     // arbitrary dir listing
    assert.throws(() => moveFile('../../a', '../../b'), /Access denied/);
  });

  it('BLOCKS absolute paths that escape the vault', () => {
    assert.throws(() => readFile(path.join(sibling, 'secret.txt')), /Access denied/);
    assert.throws(() => fileExists('/etc/hostname'), /Access denied/);
    assert.throws(() => getMtime('/etc/hostname'), /Access denied/);
  });

  it('allows a legit in-vault file whose name merely starts with dots', () => {
    // precision: the guard must not false-positive on names like "..keep"
    writeFile('..keep', 'ok');
    assert.strictEqual(readFile('..keep'), 'ok');
    assert.strictEqual(fileExists('..keep'), true);
  });

  it('throws when REPO_ROOT is unset', () => {
    setRepoRoot('');
    assert.throws(() => readFile('x'), /REPO_ROOT not set/);
  });
});
