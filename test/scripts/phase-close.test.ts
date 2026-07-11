import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findPhasePlans } from '../../scripts/phase-close';

// Fixture: a temp "completed" dir with plans of mixed phase/status/naming.
function makeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-close-'));
  const write = (name: string, body: string) =>
    fs.writeFileSync(path.join(dir, name), body, 'utf-8');

  // Feature-named plan, phase 4, completed — the case the old prefix-only matcher MISSED.
  write('ai-model-routing.md', '---\ntitle: x\nstatus: completed\nphase: 4\n---\n');
  // Legacy filename-prefixed plan, completed — must still match.
  write('phase-4-foundation.md', '---\ntitle: y\nstatus: completed\n---\n');
  // Phase 5 plan — must NOT match phase 4.
  write('chat-session-panel.md', '---\ntitle: z\nstatus: completed\nphase: 5\n---\n');
  // Phase 4 but not completed — must NOT match.
  write('half-done.md', '---\ntitle: w\nstatus: approved\nphase: 4\n---\n');
  // Non-markdown — ignored.
  write('notes.txt', 'phase: 4\nstatus: completed\n');
  return dir;
}

describe('phase-close findPhasePlans', () => {
  let dir: string;
  before(() => { dir = makeFixture(); });
  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('counts a completed plan by its frontmatter phase field (feature-named)', () => {
    const found = findPhasePlans(4, dir).map(p => path.basename(p));
    assert.ok(found.includes('ai-model-routing.md'), 'should find phase:4 frontmatter plan');
  });

  it('still counts a legacy phase-N- filename-prefixed completed plan', () => {
    const found = findPhasePlans(4, dir).map(p => path.basename(p));
    assert.ok(found.includes('phase-4-foundation.md'), 'should find prefix-named plan');
  });

  it('excludes plans of a different phase', () => {
    const found = findPhasePlans(4, dir).map(p => path.basename(p));
    assert.ok(!found.includes('chat-session-panel.md'), 'phase:5 must not count for phase 4');
  });

  it('excludes phase-matching plans that are not completed', () => {
    const found = findPhasePlans(4, dir).map(p => path.basename(p));
    assert.ok(!found.includes('half-done.md'), 'non-completed must not count');
  });

  it('finds phase 5 plans distinctly', () => {
    const found = findPhasePlans(5, dir).map(p => path.basename(p));
    assert.deepEqual(found.sort(), ['chat-session-panel.md']);
  });

  it('returns empty for a phase with no completed plans', () => {
    assert.deepEqual(findPhasePlans(9, dir), []);
  });
});
