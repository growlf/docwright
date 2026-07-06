import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as steps from '../../src/mcp/lib/steps';
import * as gate from '../../src/dispatch/completion-gate';
import { setRepoRoot, getRepoRoot } from '../../src/mcp/lib/paths';
import { transitionToCompleted } from '../../src/mcp/tools/transitions';
import { loadEndpoint } from './sveltekit-shim';

/**
 * #172 — the Web UI transition-completed endpoint must enforce the SAME
 * completion gate as the MCP tools, refusing the same plan text with the
 * identical message. Both surfaces import checkCompletionGate from
 * src/dispatch/completion-gate; this test proves the wiring end to end.
 */

// Passes status + pending-steps checks on both surfaces, then fails the gate:
// one unchecked Testing Plan box. The refusal below is the gate itself.
const FIXTURE_PLAN = `---
title: "Gate parity fixture"
status: completed
tests_defined: true
tests_human_reviewed: true
---

# Gate parity fixture

## Implementation Steps

| # | Step | Action | Status |
|---|------|--------|--------|
| 1 | Only step | Do the thing | ✅ Done |

## Testing Plan

- [x] Verified thing
- [ ] Unverified thing

### Gate Criteria

- [x] Gate met

## Document History

| Date | Change | Author |
|------|--------|--------|
`;

describe('Completion-gate parity: MCP vs Web UI (#172)', () => {
  const FIXTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-parity-'));
  const originalRoot = getRepoRoot();
  const originalEnv = process.env.DOCWRIGHT_ROOT;

  before(() => {
    for (const d of ['plans/completed', 'docs']) {
      fs.mkdirSync(path.join(FIXTURE_DIR, d), { recursive: true });
    }
    fs.writeFileSync(path.join(FIXTURE_DIR, 'plans', 'gate-fixture.md'), FIXTURE_PLAN);
  });

  after(() => {
    setRepoRoot(originalRoot);
    if (originalEnv === undefined) delete process.env.DOCWRIGHT_ROOT;
    else process.env.DOCWRIGHT_ROOT = originalEnv;
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it('MCP re-exports the dispatch gate — same function, not a copy', () => {
    assert.strictEqual(steps.checkCompletionGate, gate.checkCompletionGate);
    assert.strictEqual(steps.uncheckedTestingPlanBoxes, gate.uncheckedTestingPlanBoxes);
    assert.strictEqual(steps.hasPendingSteps, gate.hasPendingSteps);
    assert.strictEqual(steps.splitTableRow, gate.splitTableRow);
  });

  it('fixture passes the pre-gate checks, so any refusal IS the gate', () => {
    assert.strictEqual(gate.hasPendingSteps(FIXTURE_PLAN), false);
    const err = gate.checkCompletionGate(FIXTURE_PLAN, 'gate-fixture');
    assert.ok(err, 'fixture must fail the gate');
    assert.ok(err!.includes('unchecked Testing Plan item'), `unexpected gate error: ${err}`);
  });

  it('both surfaces refuse the fixture with the identical gate message', async () => {
    const expected = gate.checkCompletionGate(FIXTURE_PLAN, 'gate-fixture');
    assert.ok(expected);

    // MCP surface
    setRepoRoot(FIXTURE_DIR);
    const mcpMsg = await transitionToCompleted('gate-fixture');
    assert.strictEqual(mcpMsg, expected);

    // Web UI surface
    process.env.DOCWRIGHT_ROOT = FIXTURE_DIR;
    const { POST } = loadEndpoint(
      'src/webui/src/routes/api/lifecycle/transition-completed/+server',
    );
    const res = await POST({
      request: { json: async () => ({ plan: 'gate-fixture' }) },
      locals: { user: { displayName: 'Parity Tester', email: 'parity@example.com' } },
    } as any);
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.error, expected);

    // The refusal left the plan un-archived on both surfaces.
    assert.ok(fs.existsSync(path.join(FIXTURE_DIR, 'plans', 'gate-fixture.md')));
    assert.ok(!fs.existsSync(path.join(FIXTURE_DIR, 'plans', 'completed', 'gate-fixture.md')));
    assert.ok(!fs.existsSync(path.join(FIXTURE_DIR, 'docs', 'gate-fixture.md')));
  });
});
