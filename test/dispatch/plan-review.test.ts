import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parsePlanFrontmatter,
  asList,
  buildPlanReviewContext,
} from '../../src/dispatch/plan-review';

function makeVault(docs: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-pr-'));
  for (const [rel, content] of Object.entries(docs)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

const MINIMAL_PLAN = `---
title: "Test Plan"
status: draft
priority: high
assigned_to:
  - NetYeti
proposal_source:
  - proposals/my-proposal.md
depends_on: []
---

# Test Plan

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Do the thing | Details here | ⏳ Pending |
`;

describe('parsePlanFrontmatter', () => {
  it('parses scalar fields', () => {
    const fm = parsePlanFrontmatter(MINIMAL_PLAN);
    assert.strictEqual(fm.title, 'Test Plan');
    assert.strictEqual(fm.status, 'draft');
    assert.strictEqual(fm.priority, 'high');
  });

  it('parses block-style array assigned_to', () => {
    const fm = parsePlanFrontmatter(MINIMAL_PLAN);
    assert.deepStrictEqual(fm.assigned_to, ['NetYeti']);
  });

  it('parses block-style array proposal_source', () => {
    const fm = parsePlanFrontmatter(MINIMAL_PLAN);
    assert.deepStrictEqual(fm.proposal_source, ['proposals/my-proposal.md']);
  });

  it('parses inline array depends_on []', () => {
    const fm = parsePlanFrontmatter(MINIMAL_PLAN);
    assert.deepStrictEqual(fm.depends_on, []);
  });

  it('returns empty object for missing frontmatter', () => {
    const fm = parsePlanFrontmatter('# No frontmatter here\n\nJust body.');
    assert.deepStrictEqual(fm, {});
  });
});

describe('asList', () => {
  it('returns array as-is', () => {
    assert.deepStrictEqual(asList(['a', 'b']), ['a', 'b']);
  });

  it('wraps a string in an array', () => {
    assert.deepStrictEqual(asList('proposals/foo.md'), ['proposals/foo.md']);
  });

  it('returns [] for empty string', () => {
    assert.deepStrictEqual(asList(''), []);
  });

  it('returns [] for undefined/null', () => {
    assert.deepStrictEqual(asList(undefined), []);
    assert.deepStrictEqual(asList(null), []);
  });
});

describe('buildPlanReviewContext', () => {
  it('includes plan path, title, status, and priority', () => {
    const root = makeVault({ 'plans/test.md': MINIMAL_PLAN });
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('plans/test.md'), 'should include plan path');
    assert.ok(ctx.includes('Test Plan'), 'should include title');
    assert.ok(ctx.includes('draft'), 'should include status');
    assert.ok(ctx.includes('high'), 'should include priority');
    fs.rmSync(root, { recursive: true });
  });

  it('includes the full plan content body', () => {
    const root = makeVault({ 'plans/test.md': MINIMAL_PLAN });
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('Implementation Steps'), 'should include plan body section heading');
    assert.ok(ctx.includes('⏳ Pending'), 'should include step status');
    fs.rmSync(root, { recursive: true });
  });

  it('flags missing proposal_source file with ⚠️ warning', () => {
    const root = makeVault({ 'plans/test.md': MINIMAL_PLAN });
    // proposal_source points to proposals/my-proposal.md — NOT created in vault
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('⚠️'), 'should flag missing proposal_source');
    assert.ok(ctx.includes('FILE NOT FOUND'), 'should say FILE NOT FOUND');
    fs.rmSync(root, { recursive: true });
  });

  it('includes proposal_source content when the file exists', () => {
    const proposalContent = '---\ntitle: My Proposal\n---\n## Problem\nThis is the problem.';
    const root = makeVault({
      'plans/test.md': MINIMAL_PLAN,
      'proposals/my-proposal.md': proposalContent,
    });
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('This is the problem.'), 'should include proposal body');
    assert.ok(!ctx.includes('FILE NOT FOUND'), 'should not flag found file as missing');
    fs.rmSync(root, { recursive: true });
  });

  it('shows no proposal_source warning when proposal_source is absent', () => {
    const planNoSource = MINIMAL_PLAN.replace(/proposal_source:[\s\S]*?depends_on/, 'depends_on');
    const root = makeVault({ 'plans/test.md': planNoSource });
    const ctx = buildPlanReviewContext('plans/test.md', planNoSource, root);
    assert.ok(ctx.includes('No proposal_source field'), 'should note missing proposal_source field');
    fs.rmSync(root, { recursive: true });
  });

  it('lists found dependencies with their status', () => {
    const depPlan = '---\ntitle: Dep Plan\nstatus: completed\n---\n# Dep\n';
    const planWithDep = MINIMAL_PLAN.replace('depends_on: []',
      'depends_on:\n  - plans/completed/dep-plan.md');
    const root = makeVault({
      'plans/test.md': planWithDep,
      'plans/completed/dep-plan.md': depPlan,
    });
    const ctx = buildPlanReviewContext('plans/test.md', planWithDep, root);
    assert.ok(ctx.includes('dep-plan'), 'should list dependency name');
    assert.ok(ctx.includes('completed'), 'should show dependency status');
    fs.rmSync(root, { recursive: true });
  });

  it('flags missing dependency with ⚠️ NOT FOUND', () => {
    const planWithMissingDep = MINIMAL_PLAN.replace('depends_on: []',
      'depends_on:\n  - plans/ghost-plan.md');
    const root = makeVault({ 'plans/test.md': planWithMissingDep });
    const ctx = buildPlanReviewContext('plans/test.md', planWithMissingDep, root);
    assert.ok(ctx.includes('NOT FOUND'), 'should flag missing dep');
    assert.ok(ctx.includes('ghost-plan'), 'should name the missing dep');
    fs.rmSync(root, { recursive: true });
  });

  it('includes core policies section', () => {
    const root = makeVault({
      'plans/test.md': MINIMAL_PLAN,
      'policies/core/bugs-before-features.md': '---\ntitle: Bugs First\n---\nFix bugs before features.',
    });
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('CORE POLICIES'), 'should include policies section header');
    assert.ok(ctx.includes('bugs-before-features'), 'should name the policy file');
    assert.ok(ctx.includes('Fix bugs before features'), 'should include policy summary');
    fs.rmSync(root, { recursive: true });
  });

  it('omits core policies section gracefully when directory absent', () => {
    const root = makeVault({ 'plans/test.md': MINIMAL_PLAN });
    // No policies/core/ directory created
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('CORE POLICIES'), 'section header still present');
    // No crash — just empty section
    fs.rmSync(root, { recursive: true });
  });

  it('includes the adversarial critic questions', () => {
    const root = makeVault({ 'plans/test.md': MINIMAL_PLAN });
    const ctx = buildPlanReviewContext('plans/test.md', MINIMAL_PLAN, root);
    assert.ok(ctx.includes('ADVERSARIAL CRITIQUE'), 'should include critic section header');
    assert.ok(ctx.includes('Most likely failure modes'), 'should include failure mode question');
    assert.ok(ctx.includes('📝 note'), 'should include severity legend');
    assert.ok(ctx.includes('⚠️ warn'), 'should include warn severity');
    assert.ok(ctx.includes('🚫 block'), 'should include block severity');
    assert.ok(ctx.includes('Resolution:'), 'should include Resolution field template');
    fs.rmSync(root, { recursive: true });
  });

  it('truncates very large plan content to avoid excessive prompt size', () => {
    const bigPlan = MINIMAL_PLAN + '\n' + 'x'.repeat(10000);
    const root = makeVault({ 'plans/test.md': bigPlan });
    const ctx = buildPlanReviewContext('plans/test.md', bigPlan, root);
    // The plan content is capped at 6000 chars — context should not be unbounded
    const planContentSection = ctx.split('=== REFERENCED PROPOSALS')[0];
    assert.ok(planContentSection.length < 10000, 'plan content section should be bounded');
    fs.rmSync(root, { recursive: true });
  });
});
