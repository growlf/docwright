import assert from 'assert';
import {
  checkTransition,
  executeTransition,
  diffAnnotate,
  ActorContext,
} from '../../src/dispatch/promote';
import { ProfileConfig } from '../../src/dispatch/profile';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ── Minimal test profile ──────────────────────────────────────────────────

const TEST_PROFILE: ProfileConfig = {
  docwrightProfileVersion: '1',
  name: 'test',
  displayName: 'Test',
  description: 'Test profile',
  version: '0.1.0',
  documentTypes: ['proposal', 'plan', 'policy'],
  states: {
    proposal: ['draft', 'approved', 'rejected'],
    plan:     ['draft', 'in-progress', 'completed', 'canceled'],
    policy:   ['draft', 'active', 'archived'],
  },
  requiredFrontmatter: ['title', 'status', 'author'],
  optionalFrontmatter: [],
  features: {},
} as ProfileConfig;

// Profile with a gate
const GATED_PROFILE: ProfileConfig = {
  ...TEST_PROFILE,
  gates: [
    {
      id: 'plan-completion-gate',
      trigger: 'status-transition',
      document_type: 'plan',
      from: 'in-progress',
      to: 'completed',
      reviewer_field: 'gate_reviewer',
      blocks: 'completion',
      description: 'Plan must be reviewed before completing.',
    },
  ],
} as unknown as ProfileConfig;

// ── Temp vault fixture ────────────────────────────────────────────────────

let tmpDir = '';

function setupVault(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-test-'));
  fs.mkdirSync(path.join(tmpDir, 'plans'));
  return tmpDir;
}

function writeDoc(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function teardownVault(): void {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

const HUMAN: ActorContext = { actor: 'NetYeti', actorType: 'human' };
const AI: ActorContext = { actor: 'claude', actorType: 'ai' };

// ── checkTransition ───────────────────────────────────────────────────────

describe('checkTransition', () => {
  it('allows a valid transition between known states', () => {
    const fm = { title: 'Test', status: 'draft', author: 'NetYeti', type: 'plan' };
    const result = checkTransition('/', 'plans/test.md', 'draft', 'in-progress', fm, TEST_PROFILE);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.gates.length, 0);
    assert.strictEqual(result.gateResults.length, 0);
  });

  it('rejects a target status not in the profile state list', () => {
    const fm = { title: 'Test', status: 'draft', author: 'NetYeti', type: 'plan' };
    const result = checkTransition('/', 'plans/test.md', 'draft', 'nonexistent', fm, TEST_PROFILE);
    assert.strictEqual(result.allowed, false);
    assert.ok(result.reason?.includes("'nonexistent' is not a valid status"));
  });

  it('infers doc type from path when type field is absent', () => {
    const fm = { title: 'Test', status: 'draft', author: 'NetYeti' };
    const result = checkTransition('/', 'proposals/my-idea.md', 'draft', 'approved', fm, TEST_PROFILE);
    assert.strictEqual(result.allowed, true);
  });

  it('allows any status when doc type has no state definition', () => {
    const fm = { title: 'Test', status: 'draft', author: 'NetYeti', type: 'unknown-type' };
    const result = checkTransition('/', 'docs/readme.md', 'draft', 'anything', fm, TEST_PROFILE);
    assert.strictEqual(result.allowed, true);
  });

  it('blocks transition when a gate is pending and unreviewed', () => {
    const fm = {
      title: 'Test', status: 'in-progress', author: 'NetYeti', type: 'plan',
      gate_status: undefined, gate_reviews: [],
    };
    const result = checkTransition('/', 'plans/test.md', 'in-progress', 'completed', fm, GATED_PROFILE);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.gates.length, 1);
    assert.strictEqual(result.gates[0].id, 'plan-completion-gate');
  });

  it('allows transition when gate is approved', () => {
    const fm = {
      title: 'Test', status: 'in-progress', author: 'NetYeti', type: 'plan',
      gate_status: 'approved',
    };
    const result = checkTransition('/', 'plans/test.md', 'in-progress', 'completed', fm, GATED_PROFILE);
    assert.strictEqual(result.allowed, true);
  });

  it('allows transition when gate is waived', () => {
    const fm = {
      title: 'Test', status: 'in-progress', author: 'NetYeti', type: 'plan',
      gate_status: 'waived',
    };
    const result = checkTransition('/', 'plans/test.md', 'in-progress', 'completed', fm, GATED_PROFILE);
    assert.strictEqual(result.allowed, true);
  });
});

// ── executeTransition ─────────────────────────────────────────────────────

describe('executeTransition', () => {
  before(() => setupVault());
  after(() => teardownVault());

  it('writes new status to file and returns success', () => {
    writeDoc('plans/test.md', [
      '---',
      'title: Test Plan',
      'status: draft',
      'author: NetYeti',
      'type: plan',
      '---',
      '# Test',
    ].join('\n'));

    const fm = { title: 'Test Plan', status: 'draft', author: 'NetYeti', type: 'plan' };
    const result = executeTransition(tmpDir, 'plans/test.md', 'in-progress', HUMAN, fm, TEST_PROFILE);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.newStatus, 'in-progress');
    const written = fs.readFileSync(path.join(tmpDir, 'plans/test.md'), 'utf8');
    assert.ok(written.includes('status: in-progress'));
  });

  it('stamps ai-last-action when actor is AI', () => {
    writeDoc('plans/ai-plan.md', [
      '---',
      'title: AI Plan',
      'status: draft',
      'author: NetYeti',
      'type: plan',
      '---',
    ].join('\n'));

    const fm = { title: 'AI Plan', status: 'draft', author: 'NetYeti', type: 'plan' };
    const result = executeTransition(tmpDir, 'plans/ai-plan.md', 'in-progress', AI, fm, TEST_PROFILE);

    assert.strictEqual(result.success, true);
    const written = fs.readFileSync(path.join(tmpDir, 'plans/ai-plan.md'), 'utf8');
    assert.ok(written.includes('ai-last-action:'));
  });

  it('returns failure for invalid target status', () => {
    writeDoc('plans/bad.md', '---\ntitle: Bad\nstatus: draft\nauthor: X\ntype: plan\n---\n');
    const fm = { title: 'Bad', status: 'draft', author: 'X', type: 'plan' };
    const result = executeTransition(tmpDir, 'plans/bad.md', 'nonexistent', HUMAN, fm, TEST_PROFILE);
    assert.strictEqual(result.success, false);
    assert.ok(result.reason?.includes('not a valid status'));
  });

  it('returns failure when gate blocks transition', () => {
    writeDoc('plans/gated.md', [
      '---',
      'title: Gated Plan',
      'status: in-progress',
      'author: NetYeti',
      'type: plan',
      '---',
    ].join('\n'));

    const fm = { title: 'Gated Plan', status: 'in-progress', author: 'NetYeti', type: 'plan' };
    const result = executeTransition(tmpDir, 'plans/gated.md', 'completed', HUMAN, fm, GATED_PROFILE);
    assert.strictEqual(result.success, false);
    // File should be unchanged
    const written = fs.readFileSync(path.join(tmpDir, 'plans/gated.md'), 'utf8');
    assert.ok(written.includes('status: in-progress'));
  });
});

// ── diffAnnotate ──────────────────────────────────────────────────────────

describe('diffAnnotate', () => {
  it('returns changed fields when status changes', () => {
    const before = { title: 'Plan', status: 'draft', author: 'NetYeti', type: 'plan' };
    const after  = { title: 'Plan', status: 'in-progress', author: 'NetYeti', type: 'plan' };
    const result = diffAnnotate('/', 'plans/test.md', before, after, TEST_PROFILE);
    assert.ok(result.changedFields.includes('status'));
    assert.strictEqual(result.transitionFrom, 'draft');
    assert.strictEqual(result.transitionTo, 'in-progress');
    assert.strictEqual(result.transitionValid, true);
  });

  it('flags invalid transition in annotation', () => {
    const before = { title: 'Plan', status: 'draft', author: 'NetYeti', type: 'plan' };
    const after  = { title: 'Plan', status: 'impossible', author: 'NetYeti', type: 'plan' };
    const result = diffAnnotate('/', 'plans/test.md', before, after, TEST_PROFILE);
    assert.strictEqual(result.transitionValid, false);
  });

  it('reports no transition when only non-status fields change', () => {
    const before = { title: 'Old', status: 'draft', author: 'NetYeti', type: 'plan' };
    const after  = { title: 'New', status: 'draft', author: 'NetYeti', type: 'plan' };
    const result = diffAnnotate('/', 'plans/test.md', before, after, TEST_PROFILE);
    assert.ok(result.changedFields.includes('title'));
    assert.strictEqual(result.transitionFrom, undefined);
    assert.strictEqual(result.transitionTo, undefined);
    assert.strictEqual(result.gatesFired.length, 0);
  });

  it('reports gate fired when gated transition is annotated', () => {
    const before = { title: 'Plan', status: 'in-progress', author: 'NetYeti', type: 'plan', gate_status: undefined };
    const after  = { title: 'Plan', status: 'completed', author: 'NetYeti', type: 'plan', gate_status: undefined };
    const result = diffAnnotate('/', 'plans/test.md', before, after, GATED_PROFILE);
    assert.strictEqual(result.gatesFired.length, 1);
    assert.strictEqual(result.gatesFired[0].id, 'plan-completion-gate');
  });
});
