import assert from 'assert';
import { lintDocument, diffAnnotate } from '../../src/dispatch/linter';
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

  it('accepts valid mode: value on plan (new canonical field)', () => {
    const fm = { title: 'P', status: 'approved', author: 'A', created: '2026-01-01', assigned_to: 'X', mode: 'autonomous' };
    const results = lintDocument('plans/p.md', fm, profile);
    const err = results.find(r => r.field === 'mode');
    assert.ok(!err, `unexpected error on mode field: ${err?.message}`);
  });

  it('flags invalid mode: value on plan', () => {
    const fm = { title: 'P', status: 'approved', author: 'A', created: '2026-01-01', assigned_to: 'X', mode: 'full' };
    const results = lintDocument('plans/p.md', fm, profile);
    const err = results.find(r => r.field === 'mode');
    assert.ok(err);
    assert.strictEqual(err?.severity, 'error');
  });

  it('warns on deprecated automated: field with valid legacy value', () => {
    const fm = { title: 'P', status: 'approved', author: 'A', created: '2026-01-01', assigned_to: 'X', automated: 'full' };
    const results = lintDocument('plans/p.md', fm, profile);
    const warn = results.find(r => r.field === 'automated' && r.severity === 'warn');
    assert.ok(warn, 'expected deprecation warning on automated: full');
  });
});

describe('Knowledge graph foundation — linter rules', () => {
  it('warns on approved proposal with no related_to entries', () => {
    const fm = {
      title: 'T', author: 'A', created: '2026-01-01',
      approved: true, assigned_to: 'X', created_by: 'A@host',
      related_to: [],
    };
    const results = lintDocument('proposals/approved/t.md', fm, profile);
    const warn = results.find(r => r.field === 'related_to' && r.severity === 'warn');
    assert.ok(warn, 'should warn on approved proposal with empty related_to');
  });

  it('warns on approved proposal missing related_to field entirely', () => {
    const fm = {
      title: 'T', author: 'A', created: '2026-01-01',
      approved: true, assigned_to: 'X', created_by: 'A@host',
    };
    const results = lintDocument('proposals/t.md', fm, profile);
    const warn = results.find(r => r.field === 'related_to' && r.severity === 'warn');
    assert.ok(warn, 'should warn when related_to is absent on approved proposal');
  });

  it('does not warn on approved proposal with related_to entries', () => {
    const fm = {
      title: 'T', author: 'A', created: '2026-01-01',
      approved: true, assigned_to: 'X', created_by: 'A@host',
      related_to: ['plans/some-plan.md'],
    };
    const results = lintDocument('proposals/approved/t.md', fm, profile);
    const warn = results.find(r => r.field === 'related_to');
    assert.ok(!warn, 'should not warn when related_to is populated');
  });

  it('does not warn on unapproved proposal with empty related_to', () => {
    const fm = {
      title: 'T', author: 'A', created: '2026-01-01',
      approved: false, created_by: 'A@host',
      related_to: [],
    };
    const results = lintDocument('proposals/t.md', fm, profile);
    const warn = results.find(r => r.field === 'related_to');
    assert.ok(!warn, 'should not warn on unapproved proposal');
  });

  it('warns on active plan with empty proposal_source', () => {
    const fm = {
      title: 'P', status: 'in-progress', author: 'A', created: '2026-01-01',
      assigned_to: 'X', proposal_source: '',
    };
    const results = lintDocument('plans/p.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source' && r.severity === 'warn');
    assert.ok(warn, 'should warn on active plan with empty proposal_source');
  });

  it('warns on active plan missing proposal_source field', () => {
    const fm = {
      title: 'P', status: 'approved', author: 'A', created: '2026-01-01',
      assigned_to: 'X',
    };
    const results = lintDocument('plans/p.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source' && r.severity === 'warn');
    assert.ok(warn, 'should warn on active plan missing proposal_source');
  });

  it('does not warn on plan with proposal_source set', () => {
    const fm = {
      title: 'P', status: 'in-progress', author: 'A', created: '2026-01-01',
      assigned_to: 'X', proposal_source: 'proposals/approved/some-proposal.md',
    };
    const results = lintDocument('plans/p.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source');
    assert.ok(!warn, 'should not warn when proposal_source is set');
  });

  it('does not warn on canceled plan with empty proposal_source', () => {
    const fm = {
      title: 'P', status: 'canceled', author: 'A', created: '2026-01-01',
      assigned_to: 'X', proposal_source: '',
    };
    const results = lintDocument('plans/p.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source');
    assert.ok(!warn, 'should not warn on canceled plan');
  });

  it('does not warn on completed plan with empty proposal_source', () => {
    const fm = {
      title: 'P', status: 'completed', author: 'A', created: '2026-01-01',
      assigned_to: 'X', proposal_source: '',
    };
    const results = lintDocument('plans/completed/p.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source');
    assert.ok(!warn, 'should not warn on completed plan');
  });

  it('does not warn on phase overview plan', () => {
    const fm = {
      title: 'Phase 4', status: 'in-progress', author: 'A', created: '2026-01-01',
      assigned_to: 'X',
    };
    const results = lintDocument('plans/phase-4-foundations.md', fm, profile);
    const warn = results.find(r => r.field === 'proposal_source');
    assert.ok(!warn, 'should not warn on phase overview plan');
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

// ── diffAnnotate ─────────────────────────────────────────────────────────────

function doc(fields: Record<string, string | boolean | number>): string {
  const fm = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${fm}\n---\n\n# Body\n`;
}

describe('diffAnnotate', () => {
  it('detects a status transition', () => {
    const before = doc({ title: 'Plan', status: 'in-progress', author: 'A', created: '2026-01-01' });
    const after  = doc({ title: 'Plan', status: 'completed',   author: 'A', created: '2026-01-01' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.deepEqual(ann.statusTransition, { from: 'in-progress', to: 'completed' });
    assert.ok(ann.gateFlags.includes('lifecycle'));
    const sf = ann.changedFields.find(f => f.field === 'status');
    assert.ok(sf);
    assert.strictEqual(sf?.before, 'in-progress');
    assert.strictEqual(sf?.after, 'completed');
  });

  it('returns no statusTransition when status unchanged', () => {
    const before = doc({ title: 'Plan', status: 'in-progress' });
    const after  = doc({ title: 'Plan', status: 'in-progress' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.strictEqual(ann.statusTransition, undefined);
    assert.strictEqual(ann.gateFlags.length, 0);
    assert.strictEqual(ann.changedFields.length, 0);
  });

  it('flags approval when approved flips to true', () => {
    const before = doc({ title: 'T', approved: false });
    const after  = doc({ title: 'T', approved: true });
    const ann = diffAnnotate('proposals/t.md', before, after);
    assert.ok(ann.gateFlags.includes('approval'));
    const af = ann.changedFields.find(f => f.field === 'approved');
    assert.ok(af);
  });

  it('does not flag approval when approved stays false', () => {
    const before = doc({ title: 'T', approved: false });
    const after  = doc({ title: 'T', approved: false });
    const ann = diffAnnotate('proposals/t.md', before, after);
    assert.ok(!ann.gateFlags.includes('approval'));
  });

  it('flags gate-status when gate_status changes', () => {
    const before = doc({ title: 'T', gate_status: 'pending' });
    const after  = doc({ title: 'T', gate_status: 'approved' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.ok(ann.gateFlags.includes('gate-status'));
  });

  it('flags ai-stamp when ai-last-action changes', () => {
    const before = doc({ title: 'T' });
    const after  = doc({ title: 'T', 'ai-last-action': 'update_step' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.ok(ann.gateFlags.includes('ai-stamp'));
  });

  it('flags priority when priority changes', () => {
    const before = doc({ title: 'T', priority: 3 });
    const after  = doc({ title: 'T', priority: 1 });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.ok(ann.gateFlags.includes('priority'));
  });

  it('ignores non-governance fields (title, created, tags)', () => {
    const before = doc({ title: 'Old title', status: 'draft', created: '2026-01-01' });
    const after  = doc({ title: 'New title', status: 'draft', created: '2026-06-01' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.strictEqual(ann.changedFields.length, 0);
    assert.strictEqual(ann.gateFlags.length, 0);
  });

  it('handles new file (empty before)', () => {
    const after = doc({ title: 'New', status: 'draft', approved: false });
    const ann = diffAnnotate('plans/new.md', '', after);
    // 'status' appears in after but not before → changedField
    const sf = ann.changedFields.find(f => f.field === 'status');
    assert.ok(sf);
    assert.strictEqual(sf?.before, '(empty)');
    assert.strictEqual(sf?.after, 'draft');
  });

  it('handles multiple simultaneous governance changes', () => {
    const before = doc({ title: 'P', status: 'approved', priority: 3, assigned_to: 'Alice' });
    const after  = doc({ title: 'P', status: 'in-progress', priority: 2, assigned_to: 'Bob' });
    const ann = diffAnnotate('plans/p.md', before, after);
    assert.strictEqual(ann.gateFlags.filter(f => f === 'lifecycle').length, 1);
    assert.ok(ann.gateFlags.includes('priority'));
    assert.ok(ann.changedFields.some(f => f.field === 'assigned_to'));
    assert.ok(ann.changedFields.some(f => f.field === 'priority'));
    assert.ok(ann.changedFields.some(f => f.field === 'status'));
  });

  it('returns no flags when before and after are identical', () => {
    const content = doc({ title: 'X', status: 'draft', approved: false, priority: 2 });
    const ann = diffAnnotate('plans/p.md', content, content);
    assert.strictEqual(ann.changedFields.length, 0);
    assert.strictEqual(ann.gateFlags.length, 0);
    assert.strictEqual(ann.statusTransition, undefined);
  });
});

describe('Milestone rule + issues/ handling', () => {
  const mfn = (r: any) => r.field === 'milestone';

  it('warns when an active plan has no milestone', () => {
    const fm = {
      title: 'P', status: 'in-progress', author: 'A', created: '2026-01-01',
      assigned_to: 'A', phase: 2, proposal_source: 'proposals/approved/x.md',
    };
    const results = lintDocument('plans/x.md', fm, profile);
    const w = results.find(mfn);
    assert.ok(w && w.severity === 'warn', 'active plan without milestone should warn');
  });

  it('does not warn when an active plan has a milestone', () => {
    const fm = {
      title: 'P', status: 'in-progress', author: 'A', created: '2026-01-01',
      assigned_to: 'A', phase: 2, proposal_source: 'proposals/approved/x.md', milestone: 'future',
    };
    const results = lintDocument('plans/x.md', fm, profile);
    assert.ok(!results.find(mfn), "milestone: 'future' satisfies the rule");
  });

  it('does not warn on a completed plan without milestone', () => {
    const fm = { title: 'P', status: 'completed', author: 'A', created: '2026-01-01' };
    const results = lintDocument('plans/completed/x.md', fm, profile);
    assert.ok(!results.find(mfn), 'completed plans are not open items');
  });

  it('warns when an open issue has no milestone', () => {
    const fm = {
      title: 'Bug', status: 'open', author: 'A', created: '2026-01-01', 'author-role': 'contributor',
    };
    const results = lintDocument('issues/bug-x.md', fm, profile);
    assert.ok(results.find(mfn), 'open issue without milestone should warn');
  });

  it('does not warn on a resolved issue without milestone', () => {
    const fm = {
      title: 'Bug', status: 'resolved', author: 'A', created: '2026-01-01', 'author-role': 'contributor',
    };
    const results = lintDocument('issues/bug-x.md', fm, profile);
    assert.ok(!results.find(mfn), 'resolved issues are not open items');
  });

  it('flags unknown issue status', () => {
    const fm = {
      title: 'Bug', status: 'bogus', author: 'A', created: '2026-01-01', 'author-role': 'contributor',
    };
    const results = lintDocument('issues/bug-x.md', fm, profile);
    assert.ok(results.find(r => r.field === 'status' && r.severity === 'warn'), 'bad issue status should warn');
  });

  it('flags missing required fields on an issue', () => {
    const results = lintDocument('issues/bug-x.md', { title: 'Bug' }, profile);
    const fields = results.filter(r => r.severity === 'error').map(r => r.field);
    assert.ok(fields.includes('status') && fields.includes('author'), 'issue missing required fields should error');
  });

  it('skips README files entirely', () => {
    const results = lintDocument('issues/README.md', {}, profile);
    assert.strictEqual(results.length, 0, 'README is documentation, not a governed doc');
  });
});
