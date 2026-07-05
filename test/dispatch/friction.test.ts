import assert from 'assert';
import {
  parseFrictionLog,
  appendFrictionEntry,
  agedFrictionEntries,
  scaffoldFrictionLog,
  FRICTION_REVIEW_CADENCE_DAYS,
} from '../../src/dispatch/friction';

const LEGACY_LOG = [
  '# Friction Log',
  '',
  '## Format',
  '',
  '| Date | Category | Description | Upstream Issue |',
  '|------|----------|-------------|----------------|',
  '|      |          |             |                |',
  '| 2026-06-01 | bug | Save button eats frontmatter | #42 |',
  '| 2026-06-20 | ux-friction | Too many clicks to approve | |',
  '',
  '---',
  'Categories: bug | feature-request | ux-friction | docs-gap | missing-abstraction',
].join('\n');

describe('Friction log engine', () => {
  describe('parseFrictionLog', () => {
    it('parses legacy 4-column entries, skipping the blank template row', () => {
      const entries = parseFrictionLog(LEGACY_LOG);
      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0].date, '2026-06-01');
      assert.strictEqual(entries[0].category, 'bug');
      assert.strictEqual(entries[0].severity, '');
      assert.strictEqual(entries[0].description, 'Save button eats frontmatter');
      assert.strictEqual(entries[0].upstreamIssue, '#42');
      assert.strictEqual(entries[1].upstreamIssue, '');
    });

    it('parses 5-column entries with severity', () => {
      const raw = appendFrictionEntry(null, {
        date: '2026-07-01',
        category: 'docs-gap',
        severity: 'high',
        description: 'No adopt-vault docs',
      });
      const entries = parseFrictionLog(raw);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].severity, 'high');
      assert.strictEqual(entries[0].description, 'No adopt-vault docs');
    });

    it('returns [] for content without a friction table', () => {
      assert.deepStrictEqual(parseFrictionLog('# Nothing here\n\nprose only\n'), []);
    });
  });

  describe('appendFrictionEntry', () => {
    it('scaffolds a 5-column log when raw is null', () => {
      const raw = appendFrictionEntry(null, {
        date: '2026-07-05', category: 'bug', severity: 'low', description: 'x',
      });
      assert.ok(raw.includes('| Date | Category | Severity | Description | Upstream Issue |'));
      assert.ok(raw.includes('**Review cadence: weekly.**'));
      assert.ok(raw.includes('| 2026-07-05 | bug | low | x |  |'));
    });

    it('appends to a legacy 4-column table in 4-column form, folding severity into the description', () => {
      const raw = appendFrictionEntry(LEGACY_LOG, {
        date: '2026-07-05', category: 'bug', severity: 'high', description: 'New pain',
      });
      const entries = parseFrictionLog(raw);
      assert.strictEqual(entries.length, 3);
      assert.strictEqual(entries[2].description, '[high] New pain');
      assert.strictEqual(entries[2].severity, '');
      // Row landed inside the table, before the trailing prose
      assert.ok(raw.indexOf('| 2026-07-05 |') < raw.indexOf('Categories:'));
    });

    it('appends multiple entries in order', () => {
      let raw = scaffoldFrictionLog();
      raw = appendFrictionEntry(raw, { date: '2026-07-01', category: 'bug', severity: 'low', description: 'a' });
      raw = appendFrictionEntry(raw, { date: '2026-07-02', category: 'docs-gap', severity: 'high', description: 'b' });
      const entries = parseFrictionLog(raw);
      assert.deepStrictEqual(entries.map((e) => e.description), ['a', 'b']);
    });

    it('escapes pipes in descriptions', () => {
      const raw = appendFrictionEntry(null, {
        date: '2026-07-05', category: 'bug', severity: 'low', description: 'a | b',
      });
      const entries = parseFrictionLog(raw);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].description, 'a | b');
    });
  });

  describe('agedFrictionEntries', () => {
    const now = new Date('2026-07-05T00:00:00Z');

    it('flags untriaged entries older than the cadence', () => {
      const entries = parseFrictionLog(LEGACY_LOG);
      const aged = agedFrictionEntries(entries, now);
      assert.strictEqual(aged.length, 1);
      assert.strictEqual(aged[0].description, 'Too many clicks to approve');
    });

    it('never flags entries with an upstream issue', () => {
      const entries = [{ date: '2020-01-01', category: 'bug', severity: '', description: 'old', upstreamIssue: '#1' }];
      assert.deepStrictEqual(agedFrictionEntries(entries, now), []);
    });

    it('never flags entries younger than the cadence', () => {
      const young = new Date(now.getTime() - (FRICTION_REVIEW_CADENCE_DAYS - 1) * 86400000)
        .toISOString().slice(0, 10);
      const entries = [{ date: young, category: 'bug', severity: '', description: 'new', upstreamIssue: '' }];
      assert.deepStrictEqual(agedFrictionEntries(entries, now), []);
    });

    it('never flags entries with unparseable dates', () => {
      const entries = [{ date: 'yesterday-ish', category: 'bug', severity: '', description: 'x', upstreamIssue: '' }];
      assert.deepStrictEqual(agedFrictionEntries(entries, now), []);
    });
  });
});
