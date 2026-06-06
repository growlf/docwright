import { strict as assert } from 'assert';
import {
  getGateDefinition,
  getGatesForTransition,
  evaluateGate,
  getScheduleGatesForDocument,
  isOverdue,
  parseCadence,
  getLastGateDate,
  applyReview,
  scanAllGates,
  retroactiveAudit,
} from '../../src/dispatch/gates';
import type { GateDefinition } from '../../src/dispatch/gates';

const sampleProfile = {
  gates: [
    {
      id: 'plan-complete',
      trigger: 'status-transition',
      from: 'in-progress', to: 'completed',
      document_type: 'plan',
      reviewer_field: 'assigned_to',
      reviewers: ['contributor'],
      quorum: 1,
      blocks: 'close-plan',
      description: 'Plan owner confirms completion',
    },
    {
      id: 'policy-review',
      trigger: 'schedule',
      cadence: 'quarterly',
      status_filter: ['active'],
      document_type: 'policy',
      reviewer_field: 'gate_reviewer',
      reviewers: ['steward'],
      quorum: 1,
      blocks: 'policy-change',
      description: 'Quarterly policy review',
    },
  ],
};

describe('Gate engine', () => {

  describe('getGateDefinition', () => {
    it('extracts gates array from profile JSON', () => {
      const gates = getGateDefinition(sampleProfile);
      assert.equal(gates.length, 2);
      assert.equal(gates[0].id, 'plan-complete');
    });

    it('returns empty array for missing gates', () => {
      assert.deepEqual(getGateDefinition({}), []);
    });
  });

  describe('getGatesForTransition', () => {
    const gates: GateDefinition[] = sampleProfile.gates as GateDefinition[];

    it('matches status-transition gates by document type', () => {
      const matched = getGatesForTransition(gates, {
        document_type: 'plan',
        from: 'in-progress', to: 'completed',
      });
      assert.equal(matched.length, 1);
      assert.equal(matched[0].id, 'plan-complete');
    });

    it('does not match wrong document type', () => {
      const matched = getGatesForTransition(gates, {
        document_type: 'proposal',
        from: 'draft', to: 'approved',
      });
      assert.equal(matched.length, 0);
    });
  });

  describe('parseCadence', () => {
    it('parses "annually"', () => {
      const ms = parseCadence('annually');
      assert.ok(ms !== null);
      assert.ok(ms > 300 * 86_400_000); // > 300 days
    });

    it('parses "quarterly"', () => {
      const ms = parseCadence('quarterly');
      assert.ok(ms !== null);
      assert.ok(ms > 80 * 86_400_000); // > 80 days
    });

    it('parses ISO 8601 "P90D"', () => {
      const ms = parseCadence('P90D');
      assert.equal(ms, 90 * 86_400_000);
    });

    it('returns null for unknown cadence', () => {
      assert.equal(parseCadence('fortnightly'), null);
    });
  });

  describe('isOverdue', () => {
    const scheduleGate: GateDefinition = {
      id: 'test-schedule',
      trigger: 'schedule',
      cadence: 'monthly',
      status_filter: ['active'],
      reviewer_field: 'gate_reviewer',
      reviewers: ['steward'],
      quorum: 1,
      blocks: 'change',
      description: 'Test gate',
    };

    it('returns true for doc with no gate_date in matching status', () => {
      assert.ok(isOverdue(scheduleGate, { status: 'active' }));
    });

    it('returns false for doc with recent gate_date', () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 5); // 5 days ago
      const fm = {
        status: 'active',
        gate_date: recent.toISOString().slice(0, 10),
      };
      assert.ok(!isOverdue(scheduleGate, fm));
    });

    it('returns true for doc with old gate_date', () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 1); // 1 year ago
      const fm = {
        status: 'active',
        gate_date: old.toISOString().slice(0, 10),
      };
      assert.ok(isOverdue(scheduleGate, fm));
    });
  });

  describe('evaluateGate', () => {
    it('blocks when no reviewer assigned', () => {
      const gate: GateDefinition = {
        id: 'test',
        trigger: 'status-transition',
        from: 'a', to: 'b',
        reviewer_field: 'gate_reviewer',
        reviewers: ['steward'],
        quorum: 1,
        blocks: 'x',
        description: 'Test',
      };
      const result = evaluateGate(gate, { status: 'b' });
      assert.ok(result.blocked);
      assert.ok(result.reason?.includes('no reviewer'));
    });

    it('passes when gate_status is approved', () => {
      const gate: GateDefinition = {
        id: 'test',
        trigger: 'status-transition',
        from: 'a', to: 'b',
        reviewer_field: 'gate_reviewer',
        reviewers: ['steward'],
        quorum: 1,
        blocks: 'x',
        description: 'Test',
      };
      const result = evaluateGate(gate, { status: 'b', gate_reviewer: 'Alice', gate_status: 'approved' });
      assert.ok(!result.blocked);
    });

    it('handles multi-reviewer quorum (Phase 1a)', () => {
      const gate: GateDefinition = {
        id: 'test',
        trigger: 'status-transition',
        from: 'a', to: 'b',
        reviewer_field: 'gate_reviewer',
        reviewers: ['steward', 'governance'],
        quorum: 2,
        blocks: 'x',
        description: 'Requires 2 approvals',
      };
      // One approval — not enough
      const fm = {
        status: 'b',
        gate_reviewer: 'Alice',
        gate_reviews: [
          { reviewer: 'Alice', role: 'steward', status: 'approved', date: '2026-06-01' },
        ],
      };
      let result = evaluateGate(gate, fm as any);
      assert.ok(result.blocked);
      assert.ok(result.reason?.includes('1/2'));

      // Two approvals — passes
      fm.gate_reviews.push({ reviewer: 'Bob', role: 'governance', status: 'approved', date: '2026-06-02' });
      result = evaluateGate(gate, fm as any);
      assert.ok(!result.blocked);
      assert.ok(result.quorum_met);
    });
  });

  describe('getScheduleGatesForDocument', () => {
    const gates: GateDefinition[] = sampleProfile.gates as GateDefinition[];

    it('matches schedule gate by doc type and status', () => {
      const matched = getScheduleGatesForDocument(gates, { type: 'policy', status: 'active' });
      assert.equal(matched.length, 1);
      assert.equal(matched[0].id, 'policy-review');
    });

    it('does not match non-matching status', () => {
      const matched = getScheduleGatesForDocument(gates, { type: 'policy', status: 'draft' });
      assert.equal(matched.length, 0);
    });
  });

  describe('applyReview', () => {
    it('adds a review entry and updates gate_status', () => {
      const updated = applyReview(
        { gate_reviews: [], gate_quorum: 1 },
        'Alice', 'steward', 'approved', 'Looks good',
      );
      assert.equal(updated.gate_reviews.length, 1);
      assert.equal(updated.gate_reviews[0].reviewer, 'Alice');
      assert.equal(updated.gate_reviews[0].status, 'approved');
      assert.equal(updated.gate_status, 'approved');
    });

    it('marks waived not approved', () => {
      const updated = applyReview(
        { gate_reviews: [], gate_quorum: 1 },
        'Bob', 'governance', 'waived', 'Emergency bypass',
      );
      assert.equal(updated.gate_status, 'waived');
    });
  });

  describe('retroactiveAudit', () => {
    const gates: GateDefinition[] = sampleProfile.gates as GateDefinition[];

    it('finds plans in completed status without gate approval', () => {
      const docs = [
        {
          path: 'plans/test.md',
          fm: { title: 'Test Plan', status: 'completed', type: 'plan' },
        },
      ];
      const result = retroactiveAudit(gates, docs);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].gate_id, 'plan-complete');
      assert.equal(result.findings[0].matched, false);
    });

    it('does not flag docs with proper gate approval', () => {
      const docs = [
        {
          path: 'plans/test.md',
          fm: {
            title: 'Test Plan', status: 'completed', type: 'plan',
            gate_status: 'approved', assigned_to: 'Alice',
          },
        },
      ];
      const result = retroactiveAudit(gates, docs);
      assert.equal(result.findings.length, 0);
    });

    it('fix=true stamps gate_status: waived on each finding', () => {
      const docs = [
        {
          path: 'plans/legacy.md',
          fm: { title: 'Legacy Plan', status: 'completed', type: 'plan' },
        },
      ];
      const result = retroactiveAudit(gates, docs, true);
      assert.equal(result.findings.length, 1);
      assert.equal(result.fixes.length, 1);
      assert.equal(result.fixes[0].path, 'plans/legacy.md');
      assert.equal(result.fixes[0].frontmatter.gate_status, 'waived');
      assert.ok(result.fixes[0].frontmatter.gate_note?.includes('Retroactively waived'), 'gate_note should describe reason');
    });

    it('fix=false returns empty fixes array even with findings', () => {
      const docs = [
        {
          path: 'plans/nope.md',
          fm: { title: 'No Gate', status: 'completed', type: 'plan' },
        },
      ];
      const result = retroactiveAudit(gates, docs, false);
      assert.equal(result.findings.length, 1);
      assert.equal(result.fixes.length, 0, 'no fixes when fix=false');
    });

    it('handles multiple docs with mixed gate state', () => {
      const docs = [
        {
          path: 'plans/clean.md',
          fm: { title: 'Clean Plan', status: 'completed', type: 'plan', gate_status: 'approved' },
        },
        {
          path: 'plans/missing.md',
          fm: { title: 'Missing Gate', status: 'completed', type: 'plan' },
        },
        {
          path: 'plans/waived.md',
          fm: { title: 'Waived Plan', status: 'completed', type: 'plan', gate_status: 'waived' },
        },
      ];
      const result = retroactiveAudit(gates, docs);
      // Only the doc with no gate approval should be flagged
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].path, 'plans/missing.md');
    });

    it('does not flag docs of non-matching type', () => {
      const docs = [
        {
          path: 'proposals/test.md',
          fm: { title: 'A Proposal', status: 'completed', type: 'proposal' },
        },
      ];
      // plan-complete gate only applies to type:plan
      const result = retroactiveAudit(gates, docs);
      assert.equal(result.findings.length, 0, 'proposal type should not trigger plan gate');
    });
  });

  describe('scanAllGates', () => {
    it('returns pending, approved, waived, and overdue categories', () => {
      const result = scanAllGates([], []);
      assert.ok('pending' in result);
      assert.ok('approved' in result);
      assert.ok('waived' in result);
      assert.ok('overdue' in result);
    });
  });
});
