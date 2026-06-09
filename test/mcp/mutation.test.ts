import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { updateStep, updatePlanStatus, appendHistory, setPlanField, writePlan } from '../../src/mcp/tools/mutation';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'mutation-vault');

describe('Plan Mutation Tools', () => {
  before(() => {
    if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'plans'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'plans'), { recursive: true });
    setRepoRoot(FIXTURE_DIR);
  });

  afterEach(() => {
    const plansDir = path.join(FIXTURE_DIR, 'plans');
    fs.readdirSync(plansDir).forEach(f => fs.unlinkSync(path.join(plansDir, f)));
  });

  describe('updateStep', () => {
    it('marks a step row as done and updates counters', async () => {
      const initial = `---
title: "Test"
total_steps: 2
completed_steps: 0
---
## Implementation Steps
| Step | Action | Status |
| --- | --- | --- |
| 1 | Step one | ⏳ Pending |
| 2 | Step two | ⏳ Pending |
`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), initial);
      
      const res = await updateStep('test', 'Step one', 'done');
      assert.ok(res.includes('✅ Step updated'));
      
      const updated = fs.readFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'utf8');
      assert.ok(updated.includes('| 1 | Step one | ✅ Done |'));
      assert.ok(updated.includes('completed_steps: 1'));
    });
  });

  describe('updatePlanStatus', () => {
    it('blocks status:completed if pending steps remain', async () => {
      const content = `---
title: "Test"
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
| 1 | Do | ⏳ Pending |
`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
      const res = await updatePlanStatus('test', 'completed');
      assert.ok(res.includes('pending steps'));
    });

    it('blocks status:completed if gate check fails', async () => {
       const content = `---
title: "Test"
status: in-progress
tests_defined: false
---
## Implementation Steps
| 1 | Do | ✅ Done |
`;
       fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
       const res = await updatePlanStatus('test', 'completed');
       assert.ok(res.includes('tests_defined=false'));
    });
  });

  describe('appendHistory', () => {
    it('adds a history row', async () => {
       const content = `---\ntitle: "Test"\n---\n## Document History\n| Date | Change | Author |\n| --- | --- | --- |\n`;
       fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
       await appendHistory('test', 'Something changed');
       const updated = fs.readFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'utf8');
       assert.ok(updated.includes('Something changed'));
    });
  });

  describe('setPlanField', () => {
    it('sets a non-restricted field', async () => {
      const content = `---\ntitle: "Test"\npriority: low\n---\n`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
      await setPlanField('test', 'priority', 'high');
      const updated = fs.readFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'utf8');
      assert.ok(updated.includes('priority: high'));
    });

    it('blocks restricted fields', async () => {
       const res = await setPlanField('test', 'status', 'completed');
       assert.ok(res.includes('restricted'));
    });
  });

  describe('writePlan', () => {
    it('performs full structural rewrite with count update', async () => {
      const content = `---
title: New Title
status: in-progress
---
## Implementation Steps
| 1 | Action | ✅ Done |
`;
      await writePlan('test', content);
      const updated = fs.readFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'utf8');
      assert.ok(updated.includes('title: New Title'));
      assert.ok(updated.includes('total_steps: 1'));
      assert.ok(updated.includes('completed_steps: 1'));
    });
  });
});
