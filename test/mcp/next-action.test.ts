import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { nextAction, NextAction } from '../../src/mcp/tools/query';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'next-action-test');

describe('next_action', () => {
  before(() => {
    if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    if (!fs.existsSync(path.join(FIXTURE_DIR, 'plans'))) fs.mkdirSync(path.join(FIXTURE_DIR, 'plans'), { recursive: true });
    setRepoRoot(FIXTURE_DIR);
  });

  afterEach(() => {
    fs.readdirSync(path.join(FIXTURE_DIR, 'plans')).filter(f => f.endsWith('.md')).forEach(f => fs.unlinkSync(path.join(FIXTURE_DIR, 'plans', f)));
  });

  it('returns all-clear when no plans exist', () => {
    const res = nextAction();
    assert.equal(res.status, 'all-clear');
  });

  it('recommends first pending step in highest-priority plan', () => {
    const lowPlan = `---
title: Low Priority
priority: low
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Low task | ⏳ Pending |
`;
    const highPlan = `---
title: High Priority
priority: high
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | High task first | ⏳ Pending |
| 2 | High task second | ⏳ Pending |
`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'low-priority.md'), lowPlan);
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'high-priority.md'), highPlan);

    const res = nextAction();
    assert.equal(res.status, 'ok');
    assert.equal(res.plan, 'high-priority.md');
    assert.equal(res.step_number, 1);
    assert.ok(res.step_action?.includes('High task first'));
  });

  it('recommends first pending step after completed ones', () => {
    const plan = `---
title: Partial Progress
priority: high
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Done step | ✅ Done |
| 2 | Next step | ⏳ Pending |
| 3 | Future step | ⏳ Pending |
`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'partial.md'), plan);
    const res = nextAction();
    assert.equal(res.step_number, 2);
    assert.ok(res.step_action?.includes('Next step'));
    assert.equal(res.completed_steps, 1);
    assert.equal(res.total_steps, 3);
  });

  it('returns all-clear when all steps are done', () => {
    const plan = `---
title: All Done
priority: high
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Done | ✅ Done |
| 2 | Also done | ✅ Done |
`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'all-done.md'), plan);
    const res = nextAction();
    assert.equal(res.status, 'all-clear');
    assert.ok(res.message?.includes('All'));
  });

  it('prioritizes high over medium over low', () => {
    const writePlan = (name: string, priority: string) => {
      fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', `${name}.md`), `---
title: ${name}
priority: ${priority}
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Task | ⏳ Pending |
`);
    };
    writePlan('med-priority', 'medium');
    writePlan('low-priority', 'low');
    writePlan('high-priority', 'high');

    const res = nextAction();
    assert.equal(res.plan, 'high-priority.md');
  });

  it('uses medium as default priority when not set', () => {
    const plan = `---
title: No Priority
status: in-progress
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Task | ⏳ Pending |
`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'no-pri.md'), plan);
    const res = nextAction();
    assert.equal(res.status, 'ok');
    assert.equal(res.plan, 'no-pri.md');
  });

  it('includes approved (not yet started) plans', () => {
    const approvedPlan = `---
title: Approved Only
status: approved
---
## Implementation Steps
| Step | Action | Status |
|------|--------|--------|
| 1 | Task | ⏳ Pending |
`;
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'approved-only.md'), approvedPlan);
    const res = nextAction();
    assert.equal(res.status, 'ok');
    assert.equal(res.plan, 'approved-only.md');
  });
});
