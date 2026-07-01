import assert from 'assert';
import { compareMilestones, byPriority, buildRoadplan } from '../../src/dispatch/roadplan';

describe('Derived roadplan sorting and grouping', () => {
  describe('compareMilestones', () => {
    it('sorts "current" before everything else', () => {
      assert.ok(compareMilestones('current', 'next') < 0);
      assert.ok(compareMilestones('current', 'v0.4.0') < 0);
      assert.ok(compareMilestones('v0.4.0', 'current') > 0);
    });

    it('sorts "next" after "current" but before version numbers', () => {
      assert.ok(compareMilestones('next', 'current') > 0);
      assert.ok(compareMilestones('next', 'v0.4.0') < 0);
      assert.ok(compareMilestones('v0.4.0', 'next') > 0);
    });

    it('sorts version numbers semantically', () => {
      assert.ok(compareMilestones('v0.4.0', 'v0.5.0') < 0);
      assert.ok(compareMilestones('v0.5.0', 'v0.4.0') > 0);
      assert.ok(compareMilestones('v0.5.0', 'v0.5.1') < 0);
      assert.ok(compareMilestones('v0.10.0', 'v0.9.0') > 0);
      assert.ok(compareMilestones('v0.9.0', 'v0.10.0') < 0);
    });

    it('handles versions without v-prefix', () => {
      assert.ok(compareMilestones('0.4.0', '0.5.0') < 0);
      assert.ok(compareMilestones('v0.4.0', '0.5.0') < 0);
    });
  });

  describe('byPriority', () => {
    it('sorts highest/critical/high/medium/low correctly', () => {
      const items = [
        { priority: 'low', title: 'A' },
        { priority: 'highest', title: 'B' },
        { priority: 'medium', title: 'C' },
        { priority: 'critical', title: 'D' },
        { priority: 'high', title: 'E' },
      ];
      items.sort(byPriority);
      assert.strictEqual(items[0].title, 'B'); // highest
      assert.strictEqual(items[1].title, 'D'); // critical
      assert.strictEqual(items[2].title, 'E'); // high
      assert.strictEqual(items[3].title, 'C'); // medium
      assert.strictEqual(items[4].title, 'A'); // low
    });

    it('sorts alphabetically within the same priority tier', () => {
      const items = [
        { priority: 'high', title: 'Z' },
        { priority: 'high', title: 'A' },
        { priority: 'high', title: 'M' },
      ];
      items.sort(byPriority);
      assert.strictEqual(items[0].title, 'A');
      assert.strictEqual(items[1].title, 'M');
      assert.strictEqual(items[2].title, 'Z');
    });

    it('handles numeric priorities', () => {
      const items = [
        { priority: '2', title: 'A' },
        { priority: '0', title: 'B' },
        { priority: '1', title: 'C' },
      ];
      items.sort(byPriority);
      assert.strictEqual(items[0].title, 'B'); // 0
      assert.strictEqual(items[1].title, 'C'); // 1
      assert.strictEqual(items[2].title, 'A'); // 2
    });
  });

  describe('buildRoadplan', () => {
    it('groups plans and issues into current, next, and future', () => {
      const plans = [
        { title: 'Plan Current', milestone: 'current', priority: 'high', path: 'plans/pc.md' },
        { title: 'Plan Next', milestone: 'next', priority: 'medium', path: 'plans/pn.md' },
        { title: 'Plan Phase Overview', milestone: 'current', priority: 'high', path: 'plans/phase-3.md' }, // should be excluded
      ];
      const issues = [
        { title: 'Issue Future', milestone: 'future', priority: 'low', path: 'issues/if.md' },
        { title: 'Issue Unassigned', milestone: '', priority: 'critical', path: 'issues/iu.md' },
        { title: 'Issue V5', milestone: 'v0.5.0', priority: 'highest', path: 'issues/i5.md' },
      ];

      const roadplan = buildRoadplan(plans, issues);

      // Unique milestones in data: "current", "next", "v0.5.0"
      // Sorted: "current", "next", "v0.5.0"
      // Current name: "current"
      // Next name: "next"
      // Future: everything else (v0.5.0, future, empty)

      assert.strictEqual(roadplan.current.name, 'current');
      assert.strictEqual(roadplan.current.items.length, 1);
      assert.strictEqual(roadplan.current.items[0].title, 'Plan Current');

      assert.strictEqual(roadplan.next.name, 'next');
      assert.strictEqual(roadplan.next.items.length, 1);
      assert.strictEqual(roadplan.next.items[0].title, 'Plan Next');

      assert.strictEqual(roadplan.future.name, 'Future Pool');
      // Should contain Issue Future, Issue Unassigned, and Issue V5
      assert.strictEqual(roadplan.future.items.length, 3);
      // Sorted by priority: critical (iu) -> highest (i5) -> low (if)
      // Wait, is highest (-1) more urgent than critical (0)? Yes, highest Rank is -1, critical Rank is 0.
      // So Issue V5 (highest) -> Issue Unassigned (critical) -> Issue Future (low)
      assert.strictEqual(roadplan.future.items[0].title, 'Issue V5');
      assert.strictEqual(roadplan.future.items[1].title, 'Issue Unassigned');
      assert.strictEqual(roadplan.future.items[2].title, 'Issue Future');
    });
  });
});
