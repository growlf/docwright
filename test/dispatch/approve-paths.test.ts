import * as assert from 'node:assert';
import { normalizeProposalName, approvePaths } from '../../src/dispatch/approve-paths';

// #15 step 2.1 — one shared normalizer so neither surface can double-nest a
// proposals/approved/approved/... path from an already-approved input.
describe('approve-paths — shared proposal path resolution', () => {
  it('normalizeProposalName collapses proposals/ and approved/ segments', () => {
    assert.strictEqual(normalizeProposalName('x'), 'x.md');
    assert.strictEqual(normalizeProposalName('x.md'), 'x.md');
    assert.strictEqual(normalizeProposalName('proposals/x.md'), 'x.md');
    assert.strictEqual(normalizeProposalName('approved/x.md'), 'x.md');
    assert.strictEqual(normalizeProposalName('proposals/approved/x.md'), 'x.md');
  });

  it('approvePaths never double-nests approved/, plan always lands at plans/', () => {
    for (const input of ['x', 'x.md', 'proposals/x.md', 'proposals/approved/x.md']) {
      const p = approvePaths(input);
      assert.strictEqual(p.approved, 'proposals/approved/x.md', `approved for ${input}`);
      assert.strictEqual(p.plan, 'plans/x.md', `plan for ${input}`);
      assert.strictEqual(p.root, 'proposals/x.md', `root for ${input}`);
      assert.ok(!p.approved.includes('approved/approved'), 'no double-nest');
      assert.ok(!p.plan.includes('plans/approved'), 'no plans/approved skeleton path');
    }
  });
});
