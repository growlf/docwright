import assert from 'assert';
import { parseScopeExpr, scopeMatches, anyScopeMatches } from '../../src/policy-atoms-core/scope.js';

describe('policy-atoms-core / scope', () => {
  describe('parseScopeExpr', () => {
    it('parses simple literal', () => {
      assert.deepStrictEqual(parseScopeExpr('plan'), ['plan']);
    });
    it('parses dotted path', () => {
      assert.deepStrictEqual(parseScopeExpr('plan.approved'), ['plan', 'approved']);
    });
    it('parses wildcard segment', () => {
      assert.deepStrictEqual(parseScopeExpr('plan.*'), ['plan', '*']);
    });
    it('parses bare wildcard', () => {
      assert.deepStrictEqual(parseScopeExpr('*'), ['*']);
    });
    it('returns null for invalid expression', () => {
      assert.strictEqual(parseScopeExpr('Bad Scope'), null);
      assert.strictEqual(parseScopeExpr(''), null);
      assert.strictEqual(parseScopeExpr('123abc'), null);
    });
  });

  describe('scopeMatches', () => {
    it('exact match', () => {
      assert.ok(scopeMatches('plan', 'plan'));
      assert.ok(scopeMatches('git-commit', 'git-commit'));
    });

    it('wildcard * matches everything', () => {
      assert.ok(scopeMatches('*', 'plan'));
      assert.ok(scopeMatches('*', 'plan.approved'));
      assert.ok(scopeMatches('*', 'git-commit'));
    });

    it('prefix inheritance: plan matches plan.approved', () => {
      assert.ok(scopeMatches('plan', 'plan.approved'));
      assert.ok(scopeMatches('plan', 'plan.completing'));
      assert.ok(scopeMatches('plan', 'plan.reviewing'));
    });

    it('prefix does NOT match shorter action scope', () => {
      // atom scoped to plan.approved should NOT match bare 'plan'
      assert.ok(!scopeMatches('plan.approved', 'plan'));
    });

    it('plan.* matches plan sub-scopes but not bare plan', () => {
      assert.ok(scopeMatches('plan.*', 'plan.approved'));
      assert.ok(scopeMatches('plan.*', 'plan.completing'));
      assert.ok(!scopeMatches('plan.*', 'plan'));
      assert.ok(!scopeMatches('plan.*', 'proposal'));
    });

    it('no false cross-domain matches', () => {
      assert.ok(!scopeMatches('plan', 'proposal'));
      assert.ok(!scopeMatches('git-commit', 'plan'));
    });
  });

  describe('anyScopeMatches', () => {
    it('returns true if any scope matches', () => {
      assert.ok(anyScopeMatches(['proposal', 'plan'], 'plan.approved'));
      assert.ok(anyScopeMatches(['git-commit'], 'git-commit'));
    });
    it('returns false if none match', () => {
      assert.ok(!anyScopeMatches(['git-commit'], 'plan'));
      assert.ok(!anyScopeMatches([], 'plan'));
    });
  });
});
