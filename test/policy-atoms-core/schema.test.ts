import assert from 'assert';
import { validateAtomFrontmatter, SYNOPSIS_TOKEN_HARD, SYNOPSIS_TOKEN_SOFT } from '../../src/policy-atoms-core/schema.js';

describe('policy-atoms-core / schema', () => {
  describe('validateAtomFrontmatter', () => {
    const valid = {
      id: 'commit-format',
      kind: 'deterministic',
      scope: ['git-commit'],
      synopsis: 'Commit messages must follow type: description format.',
      version: 1,
      ai_category: 'none',
    };

    it('accepts a valid deterministic atom', () => {
      const { valid: ok, errors } = validateAtomFrontmatter(valid);
      assert.strictEqual(ok, true, JSON.stringify(errors));
    });

    it('accepts a valid judgment atom with reasoning', () => {
      const { valid: ok } = validateAtomFrontmatter({
        ...valid, kind: 'judgment', ai_category: 'reasoning',
      });
      assert.strictEqual(ok, true);
    });

    it('accepts coding ai_category for judgment atoms', () => {
      const { valid: ok } = validateAtomFrontmatter({
        ...valid, kind: 'judgment', ai_category: 'coding',
      });
      assert.strictEqual(ok, true);
    });

    it('accepts agentic ai_category for judgment atoms', () => {
      const { valid: ok } = validateAtomFrontmatter({
        ...valid, kind: 'judgment', ai_category: 'agentic',
      });
      assert.strictEqual(ok, true);
    });

    it('rejects non-object input', () => {
      const { valid: ok, errors } = validateAtomFrontmatter('not an object');
      assert.strictEqual(ok, false);
      assert.ok(errors.length > 0);
    });

    it('rejects missing required fields', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ id: 'x' });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'kind'));
    });

    it('rejects invalid id format', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, id: 'Bad_ID' });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'id'));
    });

    it('rejects empty scope array', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, scope: [] });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'scope'));
    });

    it('rejects invalid scope expression', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, scope: ['BAD SCOPE'] });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'scope'));
    });

    it('rejects deterministic atom with non-none ai_category', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, ai_category: 'reasoning' });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'ai_category'));
    });

    it('rejects judgment atom with ai_category: none', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, kind: 'judgment', ai_category: 'none' });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'ai_category'));
    });

    it('rejects version 0', () => {
      const { valid: ok, errors } = validateAtomFrontmatter({ ...valid, version: 0 });
      assert.strictEqual(ok, false);
      assert.ok(errors.some(e => e.field === 'version'));
    });

    it('rejects synopsis too short', () => {
      const { valid: ok } = validateAtomFrontmatter({ ...valid, synopsis: 'Too short' });
      assert.strictEqual(ok, false);
    });
  });

  describe('token limits', () => {
    it('SYNOPSIS_TOKEN_HARD is 1500', () => {
      assert.strictEqual(SYNOPSIS_TOKEN_HARD, 1500);
    });
    it('SYNOPSIS_TOKEN_SOFT is 1200', () => {
      assert.strictEqual(SYNOPSIS_TOKEN_SOFT, 1200);
    });
  });
});
