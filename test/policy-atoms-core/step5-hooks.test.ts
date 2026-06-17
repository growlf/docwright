/**
 * Step 5 hook interface tests.
 * Validates: AtomOverride type, OrgSourceHook, JudgmentDispatchHook signature,
 * nullOrgSourceHook, nullJudgmentDispatchHook, evaluateJudgmentAtom call site.
 */
import assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  nullOrgSourceHook,
  nullJudgmentDispatchHook,
  evaluateJudgmentAtom,
  type OrgSourceHook,
  type JudgmentDispatchHook,
  type JudgmentResult,
} from '../../src/policy-atoms-core/resolver.js';
import type { AtomOverride, Atom } from '../../src/policy-atoms-core/schema.js';

function makeJudgmentAtom(id = 'test-judgment'): Atom {
  return {
    frontmatter: {
      id,
      kind: 'judgment',
      scope: ['plan'],
      synopsis: 'Test judgment atom synopsis for hook tests.',
      version: 1,
      ai_category: 'reasoning',
    },
    context: '## Rule\nThe rule.\n## Rationale\nWhy.\n## Examples\nExample.\n## Scope\nplan\n',
  };
}

function makeCtx() {
  return { filePath: 'plans/test.md', frontmatter: {}, content: 'plan content here', vaultRoot: '/tmp' };
}

describe('Step 5 / hook interfaces', () => {
  describe('nullOrgSourceHook', () => {
    it('returns null for any atom id', async () => {
      const result = await nullOrgSourceHook('any-atom');
      assert.strictEqual(result, null);
    });

    it('satisfies OrgSourceHook type signature', async () => {
      const hook: OrgSourceHook = nullOrgSourceHook;
      const r = await hook('commit-format');
      assert.strictEqual(r, null);
    });

    it('custom hook can return AtomOverride with restricted fields', async () => {
      const override: AtomOverride = { scope: ['plan.approved'], version: 2 };
      const hook: OrgSourceHook = async (id) => id === 'commit-format' ? override : null;
      const result = await hook('commit-format');
      assert.deepStrictEqual(result, override);
      // AtomOverride cannot contain id, kind, or ai_category
      const badOverride = result as Record<string, unknown>;
      assert.strictEqual(badOverride['id'], undefined);
      assert.strictEqual(badOverride['kind'], undefined);
      assert.strictEqual(badOverride['ai_category'], undefined);
    });
  });

  describe('nullJudgmentDispatchHook', () => {
    it('returns null for any ai_category and payload', async () => {
      const result = await nullJudgmentDispatchHook('reasoning', 'any payload');
      assert.strictEqual(result, null);
    });

    it('satisfies JudgmentDispatchHook signature per Design Decision Q5', async () => {
      // Signature: (ai_category: string, payload: string) => Promise<string | null>
      const hook: JudgmentDispatchHook = nullJudgmentDispatchHook;
      const r = await hook('classification', 'test payload');
      assert.strictEqual(r, null);
    });
  });

  describe('evaluateJudgmentAtom', () => {
    it('returns skipped:true when hook returns null (no model available)', async () => {
      const atom = makeJudgmentAtom();
      const result: JudgmentResult = await evaluateJudgmentAtom(atom, makeCtx(), nullJudgmentDispatchHook);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.pass, null);
      assert.strictEqual(result.atomId, 'test-judgment');
    });

    it('returns pass:true when hook returns PASS response', async () => {
      const hook: JudgmentDispatchHook = async () => 'PASS — document complies with the rule.';
      const result = await evaluateJudgmentAtom(makeJudgmentAtom(), makeCtx(), hook);
      assert.strictEqual(result.pass, true);
      assert.strictEqual(result.skipped, false);
    });

    it('returns pass:false when hook returns FAIL response', async () => {
      const hook: JudgmentDispatchHook = async () => 'FAIL: document is missing required context.';
      const result = await evaluateJudgmentAtom(makeJudgmentAtom(), makeCtx(), hook);
      assert.strictEqual(result.pass, false);
      assert.strictEqual(result.skipped, false);
    });

    it('returns pass:null for INCONCLUSIVE response', async () => {
      const hook: JudgmentDispatchHook = async () => 'INCONCLUSIVE: insufficient context.';
      const result = await evaluateJudgmentAtom(makeJudgmentAtom(), makeCtx(), hook);
      assert.strictEqual(result.pass, null);
      assert.strictEqual(result.skipped, false);
    });

    it('hook receives ai_category and a rendered prompt containing atom synopsis', async () => {
      let capturedCategory: string | null = null;
      let capturedPayload: string | null = null;
      const hook: JudgmentDispatchHook = async (cat, payload) => {
        capturedCategory = cat;
        capturedPayload = payload;
        return 'PASS';
      };
      await evaluateJudgmentAtom(makeJudgmentAtom(), makeCtx(), hook);
      assert.strictEqual(capturedCategory, 'reasoning');
      assert.ok(capturedPayload?.includes('test-judgment'), 'prompt includes atom id');
      assert.ok(capturedPayload?.includes('Test judgment atom synopsis'), 'prompt includes synopsis');
    });

    it('throws when called on a deterministic atom', async () => {
      const deterministicAtom: Atom = {
        frontmatter: { id: 'det', kind: 'deterministic', scope: ['plan'], synopsis: 'x'.repeat(15), version: 1, ai_category: 'none' },
      };
      await assert.rejects(
        () => evaluateJudgmentAtom(deterministicAtom, makeCtx()),
        /non-judgment atom/,
      );
    });
  });
});
