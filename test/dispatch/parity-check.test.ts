import assert from 'node:assert';
import { checkParity, type ParityInput } from '../../src/dispatch/parity-check';
import { parseLocalIssue, type LocalIssue } from '../../src/dispatch/migrate-issues';
import type { ProjectItemDetail } from '../../src/dispatch/github-issues';

// GH-pivot Step 6: the Bar B parity gate. A clean migration passes all checks; each way
// juice can be lost trips exactly one check and BLOCKS cutover.

function local(slug: string, fm: Record<string, any>): LocalIssue {
  return parseLocalIssue(`issues/${slug}.md`, `---\ntitle: ${fm.title}\nstatus: ${fm.status}\ndemand_count: ${fm.demand_count}\nreported_dates: [${(fm.reported_dates || []).join(', ')}]\n---\n# ${slug}\n\nbody`);
}

function boardItem(slug: string, num: number, fields: Record<string, string | number>): ProjectItemDetail {
  return {
    itemId: `PVTI_${num}`,
    issue: { number: num, title: slug, body: `# ${slug}\n\nbody\n\n---\n_Migrated from DocWright vault_`, state: 'open', url: `https://gh/${num}`, labels: ['bug'] },
    fields: { 'DocWright ID': slug, ...fields },
  };
}

// Two local issues, ranked by demand: bug-b (5) then bug-a (2).
const LOCALS = [
  local('bug-a', { title: 'A', status: 'new', demand_count: 2, reported_dates: ['2026-07-01', '2026-07-02'] }),
  local('bug-b', { title: 'B', status: 'resolved', demand_count: 5, reported_dates: ['2026-07-03'] }),
];
function cleanBoard(): ProjectItemDetail[] {
  return [
    boardItem('bug-a', 10, { Lifecycle: 'new', Demand: 2, 'Reported Dates': '["2026-07-01","2026-07-02"]' }),
    boardItem('bug-b', 11, { Lifecycle: 'resolved', Demand: 5, 'Reported Dates': '["2026-07-03"]' }),
  ];
}
const base = (over: Partial<ParityInput> = {}): ParityInput => ({ locals: LOCALS, board: cleanBoard(), ...over });

describe('parity-check — clean migration passes', () => {
  it('all checks green', () => {
    const r = checkParity(base());
    assert.ok(r.passed, r.checks.filter(c => !c.passed).map(c => c.name + ':' + c.failures.join(';')).join(' | '));
    assert.match(r.summary, /PARITY OK/);
  });
});

describe('parity-check — each failure mode blocks cutover', () => {
  it('fails on a missing counterpart', () => {
    const board = cleanBoard().filter(i => i.fields['DocWright ID'] !== 'bug-b');
    const r = checkParity(base({ board }));
    assert.strictEqual(r.passed, false);
    assert.ok(r.checks.find(c => c.name === 'coverage-no-duplicates')!.failures.some(f => f.includes('bug-b')));
  });

  it('fails on a duplicate counterpart', () => {
    const board = [...cleanBoard(), boardItem('bug-a', 99, { Lifecycle: 'new', Demand: 2, 'Reported Dates': '["2026-07-01","2026-07-02"]' })];
    const r = checkParity(base({ board }));
    assert.strictEqual(r.passed, false);
    assert.ok(r.checks.find(c => c.name === 'coverage-no-duplicates')!.failures.some(f => f.includes('bug-a')));
  });

  it('fails on a lost reported_date (Bar B)', () => {
    const board = cleanBoard();
    board[0].fields['Reported Dates'] = '["2026-07-01"]'; // dropped 07-02
    const r = checkParity(base({ board }));
    assert.strictEqual(r.passed, false);
    assert.ok(r.checks.find(c => c.name === 'field-fidelity')!.failures.some(f => f.includes('2026-07-02')));
  });

  it('fails on a demand mismatch', () => {
    const board = cleanBoard();
    board[1].fields['Demand'] = 1; // was 5
    const r = checkParity(base({ board }));
    assert.ok(r.checks.find(c => c.name === 'field-fidelity')!.failures.some(f => f.includes('demand')));
  });

  it('fails on a wrong Lifecycle column', () => {
    const board = cleanBoard();
    board[1].fields['Lifecycle'] = 'new'; // local status resolved → should be resolved
    const r = checkParity(base({ board }));
    assert.ok(r.checks.find(c => c.name === 'field-fidelity')!.failures.some(f => f.includes('Lifecycle')));
  });

  it('fails on a missing Lifecycle column (board placement)', () => {
    const board = cleanBoard();
    delete board[0].fields['Lifecycle'];
    const r = checkParity(base({ board }));
    // field-fidelity also flags it, but board-placement must specifically fail.
    assert.strictEqual(r.checks.find(c => c.name === 'board-placement')!.passed, false);
  });

  it('fails ranking parity when demand order diverges', () => {
    // Swap demands so GH ranks bug-a above bug-b while local ranks bug-b first.
    const board = cleanBoard();
    board[0].fields['Demand'] = 9; // bug-a now 9 on the board (local still 2)
    const r = checkParity(base({ board }));
    assert.strictEqual(r.checks.find(c => c.name === 'ranking-parity')!.passed, false);
  });

  it('fails link-resolution for an unrewritten reference to a migrated issue', () => {
    const r = checkParity(base({
      docs: [{ path: 'proposals/p.md', content: 'see [[issues/bug-a]] for details' }],
      migrationMap: { 'bug-b': { number: 11, url: 'u' } }, // bug-a NOT in the map → unresolved
    }));
    assert.strictEqual(r.checks.find(c => c.name === 'link-resolution')!.passed, false);
  });

  it('passes link-resolution once the migrated slug is in the map', () => {
    const r = checkParity(base({
      docs: [{ path: 'proposals/p.md', content: 'see issues/bug-a.md' }],
      migrationMap: { 'bug-a': { number: 10, url: 'u' }, 'bug-b': { number: 11, url: 'u' } },
    }));
    assert.ok(r.checks.find(c => c.name === 'link-resolution')!.passed);
  });
});
