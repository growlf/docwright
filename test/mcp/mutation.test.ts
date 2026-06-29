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

    it('blocks status:completed if gate check fails (tests_defined=false)', async () => {
       const content = `---
title: "Test"
status: in-progress
tests_defined: false
---
## Implementation Steps
| 1 | Do | ✅ Done |

## Testing Plan

Run unit tests and verify output.
`;
       fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
       const res = await updatePlanStatus('test', 'completed');
       assert.ok(res.includes('tests_defined=false'));
    });

    it('blocks status:in-progress if steps are placeholder', async () => {
      const content = `---
title: "Test"
status: approved
---
## Implementation Steps
| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | | | ⏳ Pending |
`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
      const res = await updatePlanStatus('test', 'in-progress');
      assert.ok(res.includes('placeholder steps'), `Expected placeholder steps error, got: ${res}`);
    });

    it('allows status:in-progress when steps are filled', async () => {
      const content = `---
title: "Test"
status: approved
assigned_to: NetYeti
---
## Implementation Steps
| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Build the thing | Details here | ⏳ Pending |
`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
      const res = await updatePlanStatus('test', 'in-progress');
      assert.ok(res.includes('✅') || res.includes('in-progress'), `Expected success, got: ${res}`);
    });

    it('blocks status:completed if Testing Plan is TBD', async () => {
      const content = `---
title: "Test"
status: in-progress
tests_defined: true
tests_human_reviewed: true
---
## Implementation Steps
| Step | Action | Status |
| --- | --- | --- |
| 1 | Do | ✅ Done |

## Testing Plan

_Testing plan TBD_

### Gate Criteria

- [x] All done
`;
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), content);
      const res = await updatePlanStatus('test', 'completed');
      assert.ok(res.includes('Testing Plan') || res.includes('TBD') || res.includes('testing'), `Expected TBD error, got: ${res}`);
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

    it('emits warning (does not block) when steps are placeholder', async () => {
      const content = `---
title: Scaffold Test
status: approved
---
## Implementation Steps
| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | | | ⏳ Pending |
`;
      const res = await writePlan('test', content);
      assert.ok(res.includes('✅'), `Expected success, got: ${res}`);
      assert.ok(res.includes('Warning') || res.includes('placeholder'), `Expected placeholder warning, got: ${res}`);
      // File should still be written
      assert.ok(fs.existsSync(path.join(FIXTURE_DIR, 'plans', 'test.md')));
    });

    it('sets tests_defined:false when Testing Plan is TBD', async () => {
      const content = `---
title: TBD Test
status: approved
---
## Testing Plan

_Testing plan TBD_
`;
      await writePlan('test', content);
      const updated = fs.readFileSync(path.join(FIXTURE_DIR, 'plans', 'test.md'), 'utf8');
      assert.ok(updated.includes('tests_defined: false'), `Expected tests_defined:false, got:\n${updated}`);
    });
  });
});
