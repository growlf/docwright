import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadProfile, getActiveProfile } from '../../src/dispatch/profile';

const PROFILE_DIR = path.resolve(__dirname, '../../src/profiles/docwright-dev');
const EXPECTED_TYPES = ['code-issue', 'bug', 'proposal', 'plan', 'policy', 'decision'];

describe('docwright-dev profile', () => {
  it('profile.json parses and declares the six self-development document types', () => {
    const profile = loadProfile(PROFILE_DIR);
    assert.ok(profile, 'profile.json should load');
    assert.strictEqual(profile.name, 'docwright-dev');
    for (const t of EXPECTED_TYPES) {
      assert.ok(profile.documentTypes.includes(t), `documentTypes should include ${t}`);
    }
  });

  it('profile.json defines a state machine for every document type', () => {
    const profile = loadProfile(PROFILE_DIR)!;
    for (const t of EXPECTED_TYPES) {
      const states = (profile.states as Record<string, string[]>)[t];
      assert.ok(Array.isArray(states) && states.length > 0, `states.${t} should be a non-empty array`);
    }
  });

  it('schema.json parses and covers every declared document type', () => {
    const raw = fs.readFileSync(path.join(PROFILE_DIR, 'schema.json'), 'utf-8');
    const schema = JSON.parse(raw);
    for (const t of EXPECTED_TYPES) {
      assert.ok(schema.documentTypes[t], `schema should cover ${t}`);
    }
  });

  it('every template exists and contains an author-role field', () => {
    const templatesDir = path.join(PROFILE_DIR, 'templates');
    for (const t of EXPECTED_TYPES) {
      const file = path.join(templatesDir, `${t}.md`);
      assert.ok(fs.existsSync(file), `template ${t}.md should exist`);
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(content, /^author-role:/m, `template ${t}.md must include author-role:`);
    }
  });

  it('opencode-instructions.md embeds the core philosophy and the sorting test', () => {
    const content = fs.readFileSync(path.join(PROFILE_DIR, 'opencode-instructions.md'), 'utf-8');
    assert.match(content, /Security first/i);
    assert.match(content, /Bugs before features/i);
    assert.match(content, /deliverable is a diff/i, 'must state the code-issue vs governance sorting test');
    assert.match(content, /approved: true/, 'must state the AI cannot self-approve constraint');
  });

  it('falls back to bundled org-operations when a vault has no profile.json', () => {
    // getActiveProfile with a dir that has no profile.json returns the bundled default.
    const emptyDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dw-dev-test-'));
    const profile = getActiveProfile(emptyDir);
    assert.strictEqual(profile.name, 'org-operations');
    fs.rmdirSync(emptyDir);
  });
});
