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
