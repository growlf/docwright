import assert from 'node:assert';
import {
  checkMilestoneDates, checkIssuesInRange, auditRoadmapDates, isExemptMilestone,
  roadmapDataFromBoard, auditRoadmapFromClient,
  type MilestoneDates, type IssueDates,
} from '../../src/dispatch/roadmap-dates';

// roadmap-date-discipline: DocWright is the enforcer. Settled decisions — issues INHERIT
// the milestone range by default (only explicit per-issue dates are range-checked);
// backlog/future are exempt buckets.

describe('roadmap-dates — milestone target-date rule', () => {
  it('flags a dated milestone with no target', () => {
    const v = checkMilestoneDates([{ title: 'v0.6.0', start: '2026-07-13', target: null }]);
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].kind, 'dateless-milestone');
  });
  it('passes a milestone with a target', () => {
    assert.deepStrictEqual(checkMilestoneDates([{ title: 'v0.6.0', target: '2026-07-31' }]), []);
  });
  it('exempts backlog/future buckets', () => {
    assert.ok(isExemptMilestone({ title: 'backlog' }) && isExemptMilestone({ title: 'Future' }));
    assert.deepStrictEqual(checkMilestoneDates([{ title: 'backlog' }, { title: 'future' }]), []);
  });
});

describe('roadmap-dates — issue-in-range rule (inherit by default)', () => {
  const ms: MilestoneDates[] = [{ title: 'v0.6.0', start: '2026-07-01', target: '2026-07-31' }];

  it('an issue with NO explicit dates inherits the range (no violation)', () => {
    const iss: IssueDates[] = [{ id: 1, milestone: 'v0.6.0' }];
    assert.deepStrictEqual(checkIssuesInRange(iss, ms), []);
  });
  it('an explicit target beyond the milestone target is out-of-range', () => {
    const v = checkIssuesInRange([{ id: 2, milestone: 'v0.6.0', target: '2026-08-15' }], ms);
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].kind, 'issue-out-of-range');
  });
  it('an explicit start before the milestone start is out-of-range', () => {
    const v = checkIssuesInRange([{ id: 3, milestone: 'v0.6.0', start: '2026-06-01' }], ms);
    assert.ok(v.some(x => x.kind === 'issue-out-of-range'));
  });
  it('an inverted issue (start after target) is flagged', () => {
    const v = checkIssuesInRange([{ id: 4, milestone: 'v0.6.0', start: '2026-07-20', target: '2026-07-10' }], ms);
    assert.ok(v.some(x => x.kind === 'issue-inverted'));
  });
  it('an in-range explicit issue passes', () => {
    assert.deepStrictEqual(checkIssuesInRange([{ id: 5, milestone: 'v0.6.0', start: '2026-07-05', target: '2026-07-20' }], ms), []);
  });
  it('issues in an exempt bucket are not range-checked', () => {
    const v = checkIssuesInRange([{ id: 6, milestone: 'backlog', target: '2099-01-01' }], [{ title: 'backlog' }]);
    assert.deepStrictEqual(v, []);
  });
  it('issues with no milestone are skipped', () => {
    assert.deepStrictEqual(checkIssuesInRange([{ id: 7 }], ms), []);
  });
});

describe('roadmap-dates — roadmapDataFromBoard mapper', () => {
  it('maps board items + milestones into the validator shapes', () => {
    const items: any[] = [
      { itemId: 'i1', issue: { number: 1, milestone: 'v0.6.0', labels: [] }, fields: { 'Start date': '2026-07-05', 'Target date': '2026-07-20' } },
      { itemId: 'i2', issue: { number: 2, milestone: null, labels: [] }, fields: {} },
      { itemId: 'i3', issue: null, fields: {} }, // non-issue item → skipped
    ];
    const ms: any[] = [{ number: 1, title: 'v0.6.0', dueOn: '2026-07-31', state: 'open' }];
    const d = roadmapDataFromBoard(items, ms);
    assert.deepStrictEqual(d.milestones, [{ title: 'v0.6.0', start: null, target: '2026-07-31' }]);
    assert.strictEqual(d.issues.length, 2);
    assert.deepStrictEqual(d.issues[0], { id: 1, milestone: 'v0.6.0', start: '2026-07-05', target: '2026-07-20' });
    assert.deepStrictEqual(d.issues[1], { id: 2, milestone: null, start: null, target: null });
  });
});

describe('roadmap-dates — auditRoadmapFromClient (injected client)', () => {
  it('fetches board + milestones via the client and audits', async () => {
    const client = {
      listMilestones: async () => [{ number: 1, title: 'v0.7.0', dueOn: null, state: 'open' as const }],
      listProjectItemsDetailed: async () => [{ itemId: 'i1', issue: { number: 1, title: 't', body: '', state: 'open' as const, url: '', labels: [], milestone: 'v0.7.0' }, fields: {} }],
    };
    const r = await auditRoadmapFromClient(client);
    assert.strictEqual(r.ok, false);
    assert.ok(r.violations.some(v => v.kind === 'dateless-milestone' && v.subject === 'v0.7.0'));
  });
});

describe('roadmap-dates — combined audit', () => {
  it('aggregates violations + reports ok', () => {
    const clean = auditRoadmapDates({ milestones: [{ title: 'v0.6.0', target: '2026-07-31' }], issues: [{ id: 1, milestone: 'v0.6.0' }] });
    assert.strictEqual(clean.ok, true);
    const dirty = auditRoadmapDates({ milestones: [{ title: 'v0.7.0', target: null }], issues: [{ id: 2, milestone: 'v0.7.0', target: '2030-01-01' }] });
    assert.strictEqual(dirty.ok, false);
    assert.ok(dirty.violations.some(x => x.kind === 'dateless-milestone'));
  });
});
