#!/usr/bin/env node
/**
 * Tests for checkPendingSteps / hasPendingStepsInSection
 * Run: node test/hooks/test-pending-steps.js
 */

const fs   = require('fs');
const path = require('path');
const { hasPendingStepsInSection, checkPendingSteps } = require('../../scripts/lifecycle-gate.js');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log('  ✅', label);
    passed++;
  } else {
    console.error('  ❌', label);
    failed++;
  }
}

// ── hasPendingStepsInSection ────────────────────────────────────────────────

console.log('\nhasPendingStepsInSection:');

assert('clean plan — no ⏳ anywhere → false', !hasPendingStepsInSection(`
# My Plan
## Implementation Steps
| 1 | Do thing | ✅ Done |
| 2 | Do other | ✅ Done |
`));

assert('⏳ in Implementation Steps table → true', hasPendingStepsInSection(`
# My Plan
## Implementation Steps
| 1 | Do thing | ✅ Done |
| 2 | Not done | ⏳ Pending |
`));

assert('✅ task section with ⏳ rows → true', hasPendingStepsInSection(`
# My Plan
### Task 2 — Something ✅
| Step | Action | Status |
| 1 | Done | ✅ Done |
| 2 | Not done | ⏳ Pending |
`));

assert('⏳ in prose outside section → false (not flagged)', !hasPendingStepsInSection(`
# My Plan
Some text about ⏳ being a symbol we use sometimes in descriptions.
## Implementation Steps
| 1 | All done | ✅ Done |
`));

assert('⏳ in non-✅ task section → false', !hasPendingStepsInSection(`
# My Plan
### Task 2 — Something (not complete)
| Step | Action | Status |
| 1 | Not done | ⏳ Pending |
## Implementation Steps
| 1 | All done | ✅ Done |
`));

assert('⏳ only in Overview prose → false', !hasPendingStepsInSection(`
## Overview
We have ⏳ pending questions but that is fine.
## Implementation Steps
| 1 | Done | ✅ Done |
`));

assert('empty content → false', !hasPendingStepsInSection(''));

assert('no Implementation Steps section → false', !hasPendingStepsInSection(`
## Overview
Just some text
## Something Else
| row | ⏳ Pending |
`));

// ── checkPendingSteps with a real fixture file ──────────────────────────────

console.log('\ncheckPendingSteps (real file with pending steps):');

const planWithPending = `---
title: Test Plan
status: completed
phase: 1
---
## Implementation Steps
| 1 | Task | ⏳ Pending |
`;

const planAllDone = `---
title: Test Plan
status: completed
phase: 1
---
## Implementation Steps
| 1 | Task | ✅ Done |
`;

// Content-based checks (hasPendingStepsInSection underlies checkPendingSteps)
assert('planWithPending content has ⏳ → true', hasPendingStepsInSection(planWithPending));
assert('planAllDone content has no ⏳ → false', !hasPendingStepsInSection(planAllDone));

// checkPendingSteps only processes paths starting with 'plans/' — use that prefix
const testFixture = path.join(ROOT, 'plans', '_test-fixture.md');

fs.writeFileSync(testFixture, planWithPending, 'utf-8');
const resultPending = checkPendingSteps('plans/_test-fixture.md', { status: 'completed' });
assert('checkPendingSteps: status:completed + ⏳ file → ok:false', resultPending.ok === false);

fs.writeFileSync(testFixture, planAllDone, 'utf-8');
const resultDone = checkPendingSteps('plans/_test-fixture.md', { status: 'completed' });
assert('checkPendingSteps: status:completed + all-done file → ok:true', resultDone.ok === true);

// In-progress plans with mixed done/pending rows are normal — must not be blocked
fs.writeFileSync(testFixture, planWithPending, 'utf-8');
const resultInProgress = checkPendingSteps('plans/_test-fixture.md', { status: 'in-progress' });
assert('checkPendingSteps: status:in-progress + ⏳ file → ok:true (in-progress is fine)', resultInProgress.ok === true);

fs.unlinkSync(testFixture);

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
