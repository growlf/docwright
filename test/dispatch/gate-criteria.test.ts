import assert from 'node:assert';
import {
  parseGateCriteria, parseBinding, resolveCriterion, auditGateCriteria,
  type GateCriterion, type GateEvidence,
} from '../../src/dispatch/gate-criteria';

// Verified gate criteria (step 1) — PURE parser + tier resolver. A criterion is a claim with an
// optional inline `verify:` binding; unbound criteria keep legacy [x] semantics (safe default).

const gate = (lines: string) => `## Phase Gate\n\n${lines}\n\n## Next\n`;
const crit = (over: Partial<GateCriterion> = {}): GateCriterion =>
  ({ id: null, text: 't', checked: false, binding: null, rawLine: '', ...over });

describe('gate-criteria — parseBinding', () => {
  it('parses the machine checks', () => {
    assert.strictEqual(parseBinding('tests_pass')?.kind, 'tests_pass');
    assert.strictEqual(parseBinding('steps_done')?.kind, 'steps_done');
    const fm = parseBinding('frontmatter:tests_human_reviewed=true');
    assert.deepStrictEqual([fm?.kind, (fm as any).field, (fm as any).value], ['frontmatter', 'tests_human_reviewed', 'true']);
    assert.strictEqual((parseBinding('file_exists:policies/core/x.md') as any).path, 'policies/core/x.md');
    assert.strictEqual((parseBinding('cmd:status-check') as any).cmd, 'status-check');
  });
  it('parses human and human+check', () => {
    assert.strictEqual(parseBinding('human')?.kind, 'human');
    const hc = parseBinding('human+tests_pass');
    assert.strictEqual(hc?.kind, 'human_check');
    assert.strictEqual((hc as any).check.kind, 'tests_pass');
  });
  it('returns null for malformed bindings (⇒ treated as unbound)', () => {
    assert.strictEqual(parseBinding('bogus_check'), null);
    assert.strictEqual(parseBinding('frontmatter:no_equals'), null);
    assert.strictEqual(parseBinding('cmd:'), null);
    assert.strictEqual(parseBinding('human+nonsense'), null);
  });
});

describe('gate-criteria — parseGateCriteria', () => {
  it('parses id, text, checked-state and binding from a line', () => {
    const c = parseGateCriteria(gate('- [x] (tests) Validator unit-tested — verify: tests_pass'))[0];
    assert.deepStrictEqual([c.id, c.checked, c.binding?.kind, c.text], ['tests', true, 'tests_pass', 'Validator unit-tested']);
  });
  it('an unbound criterion has binding: null and keeps its text', () => {
    const c = parseGateCriteria(gate('- [ ] Rollback documented'))[0];
    assert.strictEqual(c.binding, null);
    assert.strictEqual(c.text, 'Rollback documented');
  });
  it('a malformed binding is dropped to unbound but text before it is kept', () => {
    const c = parseGateCriteria(gate('- [ ] (x) Do a thing — verify: bogus'))[0];
    assert.strictEqual(c.binding, null);
    assert.strictEqual(c.text, 'Do a thing');
  });
  it('accepts the -- separator as well as the em dash', () => {
    const c = parseGateCriteria(gate('- [ ] (s) Steps done -- verify: steps_done'))[0];
    assert.strictEqual(c.binding?.kind, 'steps_done');
  });
  it('reads only the FIRST gate section and stops at the next heading', () => {
    const body = `## Phase Gate\n- [ ] (a) one — verify: steps_done\n\n## Testing Plan\n### Gate Criteria\n- [ ] (b) two — verify: tests_pass\n`;
    const cs = parseGateCriteria(body);
    assert.strictEqual(cs.length, 1);
    assert.strictEqual(cs[0].id, 'a');
  });
});

describe('gate-criteria — resolveCriterion tier 1 (machine-derived)', () => {
  it('tests_pass follows tests_last_result', () => {
    const c = crit({ binding: parseBinding('tests_pass')! });
    assert.strictEqual(resolveCriterion(c, { frontmatter: { tests_last_result: 'pass' } }).satisfied, true);
    assert.strictEqual(resolveCriterion(c, { frontmatter: { tests_last_result: 'fail' } }).satisfied, false);
    assert.strictEqual(resolveCriterion(c, {}).satisfied, false); // no recorded run
  });
  it('a machine criterion is derived — the typed box is ignored', () => {
    const checkedButFailing = crit({ checked: true, binding: parseBinding('tests_pass')! });
    assert.strictEqual(resolveCriterion(checkedButFailing, { frontmatter: { tests_last_result: 'fail' } }).satisfied, false);
    const uncheckedButPassing = crit({ checked: false, binding: parseBinding('tests_pass')! });
    assert.strictEqual(resolveCriterion(uncheckedButPassing, { frontmatter: { tests_last_result: 'pass' } }).satisfied, true);
  });
  it('steps_done follows hasPendingSteps', () => {
    const c = crit({ binding: parseBinding('steps_done')! });
    assert.strictEqual(resolveCriterion(c, { hasPendingSteps: false }).satisfied, true);
    assert.strictEqual(resolveCriterion(c, { hasPendingSteps: true }).satisfied, false);
  });
  it('frontmatter:f=v compares the field', () => {
    const c = crit({ binding: parseBinding('frontmatter:tests_human_reviewed=true')! });
    assert.strictEqual(resolveCriterion(c, { frontmatter: { tests_human_reviewed: true } }).satisfied, true);
    assert.strictEqual(resolveCriterion(c, { frontmatter: { tests_human_reviewed: false } }).satisfied, false);
  });
  it('file_exists uses the injected predicate when present', () => {
    const c = crit({ binding: parseBinding('file_exists:policies/core/x.md')! });
    assert.strictEqual(resolveCriterion(c, { fileExists: () => true }).satisfied, true);
    assert.strictEqual(resolveCriterion(c, { fileExists: () => false }).satisfied, false);
  });
  it('cmd reads a recorded result keyed by id; unrun ⇒ not satisfied', () => {
    const c = crit({ id: 'st', binding: parseBinding('cmd:status-check')! });
    assert.strictEqual(resolveCriterion(c, { gateEvidence: { st: { satisfied: true } } }).satisfied, true);
    assert.strictEqual(resolveCriterion(c, {}).satisfied, false);
  });
  it('cmd without an id cannot be keyed ⇒ not satisfied, with a clear reason', () => {
    const c = crit({ id: null, binding: parseBinding('cmd:status-check')! });
    const r = resolveCriterion(c, { gateEvidence: {} });
    assert.strictEqual(r.satisfied, false);
    assert.match(r.reason, /requires an \(id\)/);
  });
});

describe('gate-criteria — resolveCriterion tiers 2 & 3 (human)', () => {
  it('tier 3 human requires an attestation', () => {
    const c = crit({ id: 'rev', binding: parseBinding('human')! });
    assert.strictEqual(resolveCriterion(c, {}).satisfied, false);
    const r = resolveCriterion(c, { attestations: { rev: { by: 'NetYeti', role: 'steward', commit: 'abc123' } } });
    assert.strictEqual(r.tier, 3);
    assert.strictEqual(r.satisfied, true);
    assert.match(r.reason, /NetYeti/);
  });
  it('tier 2 human+check: attested AND check true ⇒ satisfied', () => {
    const c = crit({ id: 'p', binding: parseBinding('human+tests_pass')! });
    const r = resolveCriterion(c, { attestations: { p: { by: 'NetYeti' } }, frontmatter: { tests_last_result: 'pass' } });
    assert.strictEqual(r.tier, 2);
    assert.strictEqual(r.satisfied, true);
  });
  it('tier 2 human+check: attested but check FALSE ⇒ blocked (contradiction named)', () => {
    const c = crit({ id: 'p', binding: parseBinding('human+tests_pass')! });
    const r = resolveCriterion(c, { attestations: { p: { by: 'NetYeti' } }, frontmatter: { tests_last_result: 'fail' } });
    assert.strictEqual(r.satisfied, false);
    assert.match(r.reason, /contradicted/);
  });
  it('tier 2 human+check: check true but NOT attested ⇒ blocked (awaiting attestation)', () => {
    const c = crit({ id: 'p', binding: parseBinding('human+tests_pass')! });
    const r = resolveCriterion(c, { frontmatter: { tests_last_result: 'pass' } });
    assert.strictEqual(r.satisfied, false);
    assert.match(r.reason, /awaiting human attestation/);
  });
});

describe('gate-criteria — resolveCriterion unbound (legacy, safe default)', () => {
  it('unbound is satisfied iff the box is checked', () => {
    assert.strictEqual(resolveCriterion(crit({ checked: true })).satisfied, true);
    assert.strictEqual(resolveCriterion(crit({ checked: false })).satisfied, false);
  });
});

describe('gate-criteria — auditGateCriteria', () => {
  it('reports satisfied only when every criterion resolves true', () => {
    const body = gate(
      '- [ ] (steps) all steps done — verify: steps_done\n' +
      '- [ ] (tests) green — verify: tests_pass\n' +
      '- [x] (legacy) hand-checked',
    );
    const ev: GateEvidence = { hasPendingSteps: false, frontmatter: { tests_last_result: 'pass' } };
    const a = auditGateCriteria(body, ev);
    assert.strictEqual(a.satisfied, true);
    assert.strictEqual(a.criteria.length, 3);

    const blocked = auditGateCriteria(body, { hasPendingSteps: true, frontmatter: { tests_last_result: 'pass' } });
    assert.strictEqual(blocked.satisfied, false);
    assert.strictEqual(blocked.unmet.length, 1);
    assert.strictEqual(blocked.unmet[0].id, 'steps');
  });
});
