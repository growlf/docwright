import assert from 'assert';
import { lintDocument } from '../../src/dispatch/linter';
import { getActiveProfile } from '../../src/dispatch/profile';

const profile = getActiveProfile('/nonexistent'); // uses default fallback

describe('Frontmatter linter', () => {
  it('returns error for missing required field on proposal', () => {
    const fm = { title: 'Test', author: 'NetYeti', created: '2026-01-01', approved: false };
    // missing created_by (assigned_to is optional for unapproved proposals)
    const results = lintDocument('proposals/test.md', fm, profile);
    const fields = results.map(r => r.field);
    assert.ok(fields.includes('created_by'), 'should flag missing created_by');
  });

  it('returns no errors for a valid proposal', () => {
    const fm = {
      title: 'Valid', author: 'NetYeti', created: '2026-01-01',
      approved: false, created_by: 'NetYeti@phoenix', assigned_to: '',
    };
    const results = lintDocument('proposals/valid.md', fm, profile);
    const errors = results.filter(r => r.severity === 'error');
    assert.strictEqual(errors.length, 0);
  });

  it('flags location invariant: proposals/approved/ with approved: false', () => {
    const fm = { title: 'T', author: 'A', created: '2026-01-01', approved: false, assigned_to: 'X' };
    const results = lintDocument('proposals/approved/bad.md', fm, profile);
    const inv = results.find(r => r.field === 'approved' && r.severity === 'error');
    assert.ok(inv, 'should flag approved !== true in proposals/approved/');
  });

  it('warns on approved proposal with empty assigned_to', () => {
    const fm = {
      title: 'T', author: 'A', created: '2026-01-01',
      approved: true, assigned_to: '', created_by: 'A@host',
    };
    const results = lintDocument('proposals/approved/t.md', fm, profile);
    const warn = results.find(r => r.field === 'assigned_to' && r.severity === 'warn');
    assert.ok(warn);
  });

  it('flags invalid automated value on plan', () => {
    const fm = { title: 'P', status: 'approved', author: 'A', created: '2026-01-01', assigned_to: 'X', automated: 'always' };
    const results = lintDocument('plans/p.md', fm, profile);
    const err = results.find(r => r.field === 'automated');
    assert.ok(err);
    assert.strictEqual(err?.severity, 'error');
  });
});

describe('Stale parent detection', () => {
  it('warns when completed sub-plan has stale parent deliverable', () => {
    const fm = {
      title: 'Sub plan', status: 'completed', author: 'NetYeti',
      created: '2026-06-09', assigned_to: 'Dev',
      parent_plan: 'phase-parent.md', parent_deliverable: '3',
    };
    const parentStatuses = { 'phase-parent.md|3': '⏳ Planned' };
    const results = lintDocument('plans/sub.md', fm, profile, parentStatuses);
    const stale = results.find(r => r.field === 'parent_plan' && r.severity === 'warn');
    assert.ok(stale, 'should warn when parent deliverable is stale');
    assert.ok(stale!.message.includes('#3'), 'message should reference deliverable number');
  });

  it('passes when completed sub-plan has parent deliverable marked done', () => {
    const fm = {
      title: 'Sub plan', status: 'completed', author: 'NetYeti',
      created: '2026-06-09', assigned_to: 'Dev',
      parent_plan: 'phase-parent.md', parent_deliverable: '2',
    };
    const parentStatuses = { 'phase-parent.md|2': '✅ Done' };
    const results = lintDocument('plans/sub.md', fm, profile, parentStatuses);
    const stale = results.find(r => r.field === 'parent_plan');
    assert.ok(!stale, 'should not warn when parent deliverable is done');
  });

  it('is no-op when parent_plan is absent', () => {
    const fm = {
      title: 'Sub plan', status: 'completed', author: 'NetYeti',
      created: '2026-06-09', assigned_to: 'Dev',
    };
    const results = lintDocument('plans/sub.md', fm, profile, {});
    const stale = results.find(r => r.field === 'parent_plan');
    assert.ok(!stale, 'should not warn when parent_plan is absent');
  });

  it('is no-op when no parentStatuses provided', () => {
    const fm = {
      title: 'Sub plan', status: 'completed', author: 'NetYeti',
      created: '2026-06-09', assigned_to: 'Dev',
      parent_plan: 'phase-parent.md', parent_deliverable: '1',
    };
    const results = lintDocument('plans/sub.md', fm, profile);
    const stale = results.find(r => r.field === 'parent_plan');
    assert.ok(!stale, 'should not warn when no parent statuses provided');
  });
});

describe('Frontmatter linter — research documents', () => {
  const validResearch = {
    title: 'Research: SSE vs WebSocket for live updates',
    status: 'active',
    question: 'Which protocol better suits DocWright live-reload needs?',
    author: 'NetYeti',
    created: '2026-06-07',
    'author-role': 'contributor',
  };

  it('passes a valid active research document', () => {
    const results = lintDocument('research/sse-vs-websocket.md', validResearch, profile);
    const errors = results.filter(r => r.severity === 'error');
    assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
  });

  it('flags missing required field: question', () => {
    const fm = { ...validResearch };
    delete (fm as any).question;
    const results = lintDocument('research/test.md', fm, profile);
    assert.ok(results.some(r => r.field === 'question' && r.severity === 'error'));
  });

  it('flags missing required field: author-role', () => {
    const fm = { ...validResearch };
    delete (fm as any)['author-role'];
    const results = lintDocument('research/test.md', fm, profile);
    assert.ok(results.some(r => r.field === 'author-role' && r.severity === 'error'));
  });

  it('flags invalid status value', () => {
    const fm = { ...validResearch, status: 'in-progress' };
    const results = lintDocument('research/test.md', fm, profile);
    assert.ok(results.some(r => r.field === 'status' && r.severity === 'error'));
  });

  it('flags status: concluded without conclusion field', () => {
    const fm = { ...validResearch, status: 'concluded' };
    const results = lintDocument('research/test.md', fm, profile);
    assert.ok(results.some(r => r.field === 'conclusion' && r.severity === 'error'));
  });

  it('passes a valid concluded research document with conclusion', () => {
    const fm = { ...validResearch, status: 'concluded', conclusion: 'recommends' };
    const results = lintDocument('research/test.md', fm, profile);
    const errors = results.filter(r => r.severity === 'error');
    assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
  });

  it('flags an invalid conclusion enum value', () => {
    const fm = { ...validResearch, status: 'concluded', conclusion: 'maybe' };
    const results = lintDocument('research/test.md', fm, profile);
    assert.ok(results.some(r => r.field === 'conclusion' && r.severity === 'error'));
  });

  it('does not apply research rules to non-research paths', () => {
    const fm = { ...validResearch, status: 'invalid-for-research' };
    const results = lintDocument('proposals/test.md', fm, profile);
    assert.ok(!results.some(r => r.message.includes('Research status')));
  });
});
