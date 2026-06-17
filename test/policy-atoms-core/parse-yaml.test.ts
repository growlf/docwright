import assert from 'assert';
import { parseAtomYaml } from '../../src/policy-atoms-core/parse-yaml.js';

describe('policy-atoms-core / parse-yaml', () => {
  it('parses simple scalars', () => {
    const r = parseAtomYaml('id: my-atom\nversion: 1\ndistributable: true\n');
    assert.strictEqual(r.id, 'my-atom');
    assert.strictEqual(r.version, 1);
    assert.strictEqual(r.distributable, true);
  });

  it('parses inline arrays', () => {
    const r = parseAtomYaml('scope: [plan, proposal]\n');
    assert.deepStrictEqual(r.scope, ['plan', 'proposal']);
  });

  it('parses block arrays', () => {
    const r = parseAtomYaml('scope:\n  - plan\n  - proposal\n');
    assert.deepStrictEqual(r.scope, ['plan', 'proposal']);
  });

  it('strips quotes from string values', () => {
    const r = parseAtomYaml('synopsis: "My synopsis"\n');
    assert.strictEqual(r.synopsis, 'My synopsis');
  });

  it('handles single-quoted values', () => {
    const r = parseAtomYaml("synopsis: 'My synopsis'\n");
    assert.strictEqual(r.synopsis, 'My synopsis');
  });

  it('skips comment lines', () => {
    const r = parseAtomYaml('# comment\nid: atom-x\n');
    assert.strictEqual(r.id, 'atom-x');
    assert.ok(!('# comment' in r));
  });

  it('parses false boolean', () => {
    const r = parseAtomYaml('distributable: false\n');
    assert.strictEqual(r.distributable, false);
  });

  it('returns empty object for empty input', () => {
    const r = parseAtomYaml('');
    assert.deepStrictEqual(r, {});
  });

  it('handles whitespace-only lines', () => {
    const r = parseAtomYaml('id: x\n   \nversion: 2\n');
    assert.strictEqual(r.id, 'x');
    assert.strictEqual(r.version, 2);
  });
});
