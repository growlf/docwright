import assert from 'assert';
import { route } from '../../src/policy-atoms-core/router.js';
import { SynopsisIndex } from '../../src/policy-atoms-core/schema.js';

function makeIndex(atoms: Array<{ id: string; scope: string[]; kind?: string; ai_category?: string }>): SynopsisIndex {
  return {
    generated: '2026-06-17T00:00:00Z',
    docwright_version: '0.3.1',
    token_count: 100,
    token_limit: 1500,
    atoms: atoms.map(a => ({
      id: a.id,
      kind: (a.kind ?? 'deterministic') as 'deterministic' | 'judgment',
      scope: a.scope,
      synopsis: `${a.id} synopsis`,
      version: 1,
      ai_category: (a.ai_category ?? 'none') as 'none' | 'classification' | 'generation' | 'reasoning',
    })),
  };
}

describe('policy-atoms-core / router', () => {
  const index = makeIndex([
    { id: 'commit-format', scope: ['git-commit'] },
    { id: 'frontmatter-validate', scope: ['proposal', 'plan'] },
    { id: 'no-work-before-approval', scope: ['plan'] },
    { id: 'plan-scope-adequacy', scope: ['plan'], kind: 'judgment', ai_category: 'reasoning' },
    { id: 'global-rule', scope: ['*'] },
  ]);

  it('routes git-commit scope to correct atoms', () => {
    const { atomIds } = route(index, 'git-commit');
    assert.ok(atomIds.includes('commit-format'));
    assert.ok(atomIds.includes('global-rule'));
    assert.ok(!atomIds.includes('frontmatter-validate'));
  });

  it('routes plan.approved to plan-scoped atoms via inheritance', () => {
    const { atomIds } = route(index, 'plan.approved');
    assert.ok(atomIds.includes('no-work-before-approval'));
    assert.ok(atomIds.includes('frontmatter-validate'));
    assert.ok(atomIds.includes('plan-scope-adequacy'));
    assert.ok(atomIds.includes('global-rule'));
    assert.ok(!atomIds.includes('commit-format'));
  });

  it('routes proposal scope correctly', () => {
    const { atomIds } = route(index, 'proposal');
    assert.ok(atomIds.includes('frontmatter-validate'));
    assert.ok(!atomIds.includes('commit-format'));
    assert.ok(!atomIds.includes('no-work-before-approval'));
  });

  it('filters by kind', () => {
    const { atomIds } = route(index, 'plan', { kind: 'deterministic' });
    assert.ok(!atomIds.includes('plan-scope-adequacy'));
    assert.ok(atomIds.includes('no-work-before-approval'));
  });

  it('returns empty for unmatched scope', () => {
    const emptyIndex = makeIndex([{ id: 'plan-only', scope: ['plan'] }]);
    const { atomIds } = route(emptyIndex, 'git-commit');
    assert.strictEqual(atomIds.length, 0);
  });
});
