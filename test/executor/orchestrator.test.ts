import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executePlan, isExecuting } from '../../src/executor/orchestrator';
import { parsePlanSteps } from '../../src/executor/plan-parser';

function makePlan(steps: Array<{ n: number; action: string; status: string }>): string {
  const rows = steps.map(s =>
    `| ${s.n} | ${s.action} | Details for step ${s.n} | ${s.status} |`
  ).join('\n');

  return `# Test Plan

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
${rows}

## Next Section
`;
}

function makeTempPlan(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-exec-'));
  const fp = path.join(dir, 'test-plan.md');
  fs.writeFileSync(fp, content);
  return fp;
}

describe('orchestrator', () => {
  afterEach(() => {
    // Cleanup any leaked IN_FLIGHT entries from hanging promise tests
    // (hack: directly manipulate import — cleaner to expose a reset in prod)
    const IN_FLIGHT = new Map<string, true>();
    // Re-register via module-level API — can't access private map, so this is
    // a no-op. Instead, just ensure the follow-up test uses a unique plan name.
  });

  describe('isExecuting', () => {
    it('returns false for unknown plan', () => {
      assert.strictEqual(isExecuting('nonexistent'), false);
    });
  });

  afterEach(() => {
    // no-op: each test uses unique temp paths so plan names don't collide
  });

  describe('executePlan', () => {
    it('emits done immediately when no pending steps', async () => {
      const content = makePlan([
        { n: 1, action: 'Step one', status: '✅ Done' },
        { n: 2, action: 'Step two', status: '✅ Done' },
      ]);
      const fp = makeTempPlan(content);

      const events: Array<{ event: string; data: any }> = [];
      const send = (event: string, data: any) => events.push({ event, data });

      await executePlan(fp, async () => ({ success: true }), send);

      const doneEvents = events.filter(e => e.event === 'done');
      assert.strictEqual(doneEvents.length, 1);
      assert.ok(doneEvents[0].data.message.includes('complete'));
    });

    it('executes pending steps in order', async () => {
      const content = makePlan([
        { n: 1, action: 'First', status: '⏳ Pending' },
        { n: 2, action: 'Second', status: '⏳ Pending' },
      ]);
      const fp = makeTempPlan(content);

      const executed: number[] = [];
      const events: Array<{ event: string; data: any }> = [];
      const send = (event: string, data: any) => events.push({ event, data });

      await executePlan(fp, async (step) => {
        executed.push(step.stepNumber);
        return { success: true };
      }, send);

      assert.deepStrictEqual(executed, [1, 2]);

      const stepDoneEvents = events.filter(e => e.event === 'step_done');
      assert.strictEqual(stepDoneEvents.length, 2);
      assert.strictEqual(stepDoneEvents[0].data.step, 1);
      assert.strictEqual(stepDoneEvents[1].data.step, 2);

      const doneEvents = events.filter(e => e.event === 'done');
      assert.strictEqual(doneEvents.length, 1);

      // Verify plan file was updated on disk
      const updatedContent = fs.readFileSync(fp, 'utf-8');
      const steps = parsePlanSteps(updatedContent);
      assert.strictEqual(steps[0].status, 'done');
      assert.strictEqual(steps[1].status, 'done');
    });

    it('emits error and stops on step failure', async () => {
      const content = makePlan([
        { n: 1, action: 'First', status: '⏳ Pending' },
        { n: 2, action: 'Second', status: '⏳ Pending' },
      ]);
      const fp = makeTempPlan(content);

      const executed: number[] = [];
      const events: Array<{ event: string; data: any }> = [];
      const send = (event: string, data: any) => events.push({ event, data });

      await executePlan(fp, async (step) => {
        executed.push(step.stepNumber);
        if (step.stepNumber === 1) return { success: false, error: 'Intentional failure' };
        return { success: true };
      }, send);

      assert.deepStrictEqual(executed, [1]); // Second should not execute

      const errorEvents = events.filter(e => e.event === 'error');
      assert.strictEqual(errorEvents.length, 1);
      assert.ok(errorEvents[0].data.message.includes('Intentional failure'));
    });

    it('emits status events during execution', async () => {
      const content = makePlan([
        { n: 1, action: 'First', status: '⏳ Pending' },
      ]);
      const fp = makeTempPlan(content);

      const events: Array<{ event: string; data: any }> = [];
      const send = (event: string, data: any) => events.push({ event, data });

      await executePlan(fp, async () => ({ success: true }), send);

      const eventTypes = events.map(e => e.event);
      assert.ok(eventTypes.includes('status'));
      assert.ok(eventTypes.includes('step_done'));
      assert.ok(eventTypes.includes('done'));
    });

    it('blocks duplicate execution on same plan', async () => {
      const content = makePlan([
        { n: 1, action: 'Step one', status: '⏳ Pending' },
        { n: 2, action: 'Step two', status: '⏳ Pending' },
      ]);
      const fp = makeTempPlan(content);
      const planName = 'test-plan';

      let firstStepResolve: (v: { success: true; sessionId?: string }) => void;
      const firstStep = new Promise<{ success: true; sessionId?: string }>(resolve => {
        firstStepResolve = resolve;
      });

      // Start first execution (hangs on step 1 until we release it)
      const p1 = executePlan(fp, async () => firstStep, () => {});

      // Give it a tick to set IN_FLIGHT
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(isExecuting(planName), true);

      // Try second execution — should return error early (not 409, just error event)
      let secondError: any = null;
      await executePlan(fp, async () => ({ success: true }), (ev, data) => {
        if (ev === 'error') secondError = data;
      });
      assert.ok(secondError, 'expected error from duplicate');
      assert.ok(secondError.message.includes('already being executed'));

      // Release first execution
      firstStepResolve!({ success: true });
      await p1;
    }).timeout(5000);
  });

  describe('markStepStatus (via executePlan)', () => {
    it('marks only the executed step as done on disk', async () => {
      const content = makePlan([
        { n: 1, action: 'First', status: '⏳ Pending' },
        { n: 2, action: 'Second', status: '⏳ Pending' },
      ]);
      const fp = makeTempPlan(content);

      await executePlan(fp, async (step) => {
        if (step.stepNumber === 2) return { success: false, error: 'fail' };
        return { success: true };
      }, () => {});

      const updated = parsePlanSteps(fs.readFileSync(fp, 'utf-8'));
      assert.strictEqual(updated[0].status, 'done');
      assert.strictEqual(updated[1].status, 'failed');
    });
  });
});
