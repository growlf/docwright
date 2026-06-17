import assert from 'assert';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fieldRequired } from '../../../src/policy-atoms-core/checks/field-required.js';
import { statusTransitionAllowed } from '../../../src/policy-atoms-core/checks/status-transition-allowed.js';
import { regexMatch } from '../../../src/policy-atoms-core/checks/regex-match.js';
import { linkedArtifactExists } from '../../../src/policy-atoms-core/checks/linked-artifact-exists.js';
import { CheckContext } from '../../../src/policy-atoms-core/schema.js';

function ctx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    filePath: 'proposals/test.md',
    frontmatter: {},
    content: '',
    vaultRoot: '/tmp',
    ...overrides,
  };
}

describe('policy-atoms-core / checks / fieldRequired', () => {
  it('passes when field is present', () => {
    const r = fieldRequired('title')(ctx({ frontmatter: { title: 'My Proposal' } }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });
  it('fails when field is absent', () => {
    const r = fieldRequired('title')(ctx({ frontmatter: {} }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('fails when field is empty string', () => {
    const r = fieldRequired('title')(ctx({ frontmatter: { title: '' } }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('fails when field is empty array', () => {
    const r = fieldRequired('tags')(ctx({ frontmatter: { tags: [] } }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('passes when field is zero (falsy but present)', () => {
    const r = fieldRequired('count')(ctx({ frontmatter: { count: 0 } }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });
});

describe('policy-atoms-core / checks / statusTransitionAllowed', () => {
  const allowed = ['draft', 'approved', 'in-progress', 'completed'];
  const transitions = { draft: ['approved'], approved: ['in-progress'], 'in-progress': ['completed'] };

  it('passes for valid status', () => {
    const r = statusTransitionAllowed(allowed)(ctx({ frontmatter: { status: 'draft' } }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });
  it('fails for invalid status', () => {
    const r = statusTransitionAllowed(allowed)(ctx({ frontmatter: { status: 'pending' } }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('fails for missing status', () => {
    const r = statusTransitionAllowed(allowed)(ctx({ frontmatter: {} }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('validates transitions when from field provided', () => {
    const check = statusTransitionAllowed(allowed, transitions, 'prior_status');
    const pass = check(ctx({ frontmatter: { status: 'approved', prior_status: 'draft' } }));
    assert.strictEqual((pass as { pass: boolean }).pass, true);
    const fail = check(ctx({ frontmatter: { status: 'completed', prior_status: 'draft' } }));
    assert.strictEqual((fail as { pass: boolean }).pass, false);
  });
});

describe('policy-atoms-core / checks / regexMatch', () => {
  it('passes when content matches', () => {
    const r = regexMatch('^feat:')(ctx({ content: 'feat: add thing' }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });
  it('fails when content does not match', () => {
    const r = regexMatch('^feat:')(ctx({ content: 'add thing without type' }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
  it('checks specific field when field provided', () => {
    const r = regexMatch('^[a-z]', 'id')(ctx({ frontmatter: { id: 'my-atom' } }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
    const r2 = regexMatch('^[a-z]', 'id')(ctx({ frontmatter: { id: 'BadId' } }));
    assert.strictEqual((r2 as { pass: boolean }).pass, false);
  });
  it('supports flags', () => {
    const r = regexMatch('hello', undefined, 'i')(ctx({ content: 'Hello World' }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });
});

describe('policy-atoms-core / checks / linkedArtifactExists', () => {
  let tmpDir: string;

  before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-linked-')); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('passes when linked file exists', () => {
    const file = path.join(tmpDir, 'proposals', 'my-proposal.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# test', 'utf8');
    const r = linkedArtifactExists('proposal_source')(ctx({
      vaultRoot: tmpDir,
      frontmatter: { proposal_source: 'proposals/my-proposal' },
    }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });

  it('fails when linked file does not exist', () => {
    const r = linkedArtifactExists('proposal_source')(ctx({
      vaultRoot: tmpDir,
      frontmatter: { proposal_source: 'proposals/nonexistent' },
    }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });

  it('strips wikilink syntax', () => {
    const file = path.join(tmpDir, 'plans', 'my-plan.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# plan', 'utf8');
    const r = linkedArtifactExists('parent_plan')(ctx({
      vaultRoot: tmpDir,
      frontmatter: { parent_plan: '[[plans/my-plan]]' },
    }));
    assert.strictEqual((r as { pass: boolean }).pass, true);
  });

  it('fails when field is missing', () => {
    const r = linkedArtifactExists('proposal_source')(ctx({ vaultRoot: tmpDir, frontmatter: {} }));
    assert.strictEqual((r as { pass: boolean }).pass, false);
  });
});
