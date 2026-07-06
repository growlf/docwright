import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from '../../src/dispatch/frontmatter';

describe('Canonical frontmatter parser (#94)', () => {
  it('keeps unquoted dates as strings, not Date objects', () => {
    const fm = parseFrontmatter('---\ncreated: 2026-07-05\n---\nbody');
    assert.strictEqual(typeof fm.created, 'string');
    assert.strictEqual(fm.created, '2026-07-05');
  });

  it('parses booleans, numbers, block lists, and quoted strings', () => {
    const fm = parseFrontmatter(
      '---\napproved: true\nn: 3\ntags:\n  - a\n  - b\ntitle: "Quoted: colon fine"\n---\n',
    );
    assert.strictEqual(fm.approved, true);
    assert.strictEqual(fm.n, 3);
    assert.deepStrictEqual(fm.tags, ['a', 'b']);
    assert.strictEqual(fm.title, 'Quoted: colon fine');
  });

  it('tolerates unquoted colons in values via the fallback parser', () => {
    const fm = parseFrontmatter(
      '---\ntitle: Developer model: store of record and sync\nstatus: draft\n---\n',
    );
    assert.strictEqual(fm.title, 'Developer model: store of record and sync');
    assert.strictEqual(fm.status, 'draft');
  });

  it('tolerates generator-malformed tags without dropping other fields', () => {
    const fm = parseFrontmatter(
      '---\ntitle: "T"\nstatus: completed\ntags: - mcp\ncreated: 2026-06-14\n---\n',
    );
    assert.strictEqual(fm.status, 'completed');
    assert.strictEqual(fm.created, '2026-06-14');
  });

  it('parses every real vault document to a non-empty frontmatter object', () => {
    const ROOT = path.resolve(__dirname, '..', '..');
    const dirs = ['plans', 'plans/completed', 'proposals', 'proposals/approved', 'issues', 'docs'];
    let checked = 0;
    for (const d of dirs) {
      const full = path.join(ROOT, d);
      if (!fs.existsSync(full)) continue;
      for (const f of fs.readdirSync(full)) {
        if (!f.endsWith('.md') || f === 'README.md') continue;
        const raw = fs.readFileSync(path.join(full, f), 'utf8');
        if (!/^---\n/.test(raw)) continue;
        checked++;
        const fm = parseFrontmatter(raw);
        assert.ok(
          Object.keys(fm).length > 0,
          `${d}/${f}: frontmatter parsed to empty object`,
        );
      }
    }
    assert.ok(checked > 50, `sanity: only ${checked} docs checked`);
  });
});

describe('No duplicate frontmatter parsers (#94 grep-guard)', () => {
  const ROOT = path.resolve(__dirname, '..', '..');

  // Plain-node .js scripts can't import TS dispatch without a loader and are
  // tracked in the plan. No NEW copies may appear anywhere. (The client-side
  // +page.svelte copy was consolidated into $lib/markdown-roundtrip in Step 5.)
  const ALLOWED = new Set([
    'scripts/vault-status.js',
    'scripts/plan-health.js',
    'scripts/lifecycle-gate.js',
    'scripts/critique-plan.js',
  ]);

  function* walk(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(full);
      else if (/\.(ts|js|svelte)$/.test(entry.name)) yield full;
    }
  }

  it('no local parseFm/parseFrontmatter definitions outside dispatch + allowlist', () => {
    const offenders: string[] = [];
    for (const dir of ['src/webui/src', 'src/mcp', 'scripts']) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        const content = fs.readFileSync(file, 'utf8');
        if (/function\s+(parseFm|parseFrontmatter)\s*\(/.test(content)) {
          offenders.push(rel);
        }
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      `duplicate frontmatter parser definitions found (import from src/dispatch/frontmatter instead):\n${offenders.join('\n')}`,
    );
  });
});
