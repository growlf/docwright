import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  computeSignals,
  computeConfidence,
  classifyRelationship,
  scanProposal,
  loadRelationshipMap,
  saveRelationshipMap,
  rebuildRelationships,
} from '../../src/dispatch/relationships';

function makeVault(docs: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-rel-'));
  for (const [rel, content] of Object.entries(docs)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

describe('Relationship engine', () => {

  describe('computeSignals', () => {
    it('returns high jaccard for similar proposals', () => {
      const a = '---\ntitle: Rename document\ntags: [ux, sidebar]\n---\nCannot rename a document in the sidebar tree.\nAdd inline rename to file tree.';
      const b = '---\ntitle: File rename UX\ntags: [ux, sidebar]\n---\nNo way to rename files from the sidebar.\nDouble-click filename to rename.';
      const signals = computeSignals(a, b);
      assert.ok(signals.jaccard > 0.1, `jaccard should be positive: ${signals.jaccard}`);
      assert.ok(signals.tag_overlap > 0.8, `tag_overlap should be high: ${signals.tag_overlap}`);
    });

    it('returns near-zero jaccard for unrelated proposals', () => {
      const a = '---\ntitle: Rename document\ntags: [ux]\n---\nCannot rename a document in the sidebar.';
      const b = '---\ntitle: Network topology\ntags: [infra]\n---\nIP addressing for the data centre rack.';
      const signals = computeSignals(a, b);
      assert.ok(signals.jaccard < 0.05, `jaccard should be near zero: ${signals.jaccard}`);
      assert.strictEqual(signals.tag_overlap, 0);
      assert.strictEqual(signals.phase_match, 0);
    });

    it('detects phase match', () => {
      const a = '---\ntitle: Phase 2 UI\ntags: []\nphase: "Phase 2"\n---\nSome UI work.';
      const b = '---\ntitle: Phase 2 API\ntags: []\nphase: "Phase 2"\n---\nSome API work.';
      const signals = computeSignals(a, b);
      assert.strictEqual(signals.phase_match, 1);
    });

    it('detects same author', () => {
      const a = '---\ntitle: Doc A\ntags: []\nauthor: NetYeti\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\nauthor: NetYeti\n---\nContent B.';
      const signals = computeSignals(a, b);
      assert.strictEqual(signals.same_author, 1);
    });

    it('detects explicit related_to', () => {
      const a = '---\ntitle: Doc A\ntags: []\nrelated_to: [proposals/b.md]\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\n---\nContent B.';
      const signals = computeSignals(a, b, 'proposals/a.md', 'proposals/b.md');
      assert.strictEqual(signals.explicit_related, 1);
    });

    it('detects explicit relationship via depends_on', () => {
      const a = '---\ntitle: Doc A\ntags: []\ndepends_on:\n  - proposals/b.md\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\n---\nContent B.';
      const signals = computeSignals(a, b, 'proposals/a.md', 'proposals/b.md');
      assert.strictEqual(signals.explicit_related, 1);
    });

    it('detects explicit relationship via absorbs', () => {
      const a = '---\ntitle: Bundle\ntags: []\nabsorbs:\n  - proposals/b.md\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\n---\nContent B.';
      const signals = computeSignals(a, b, 'proposals/a.md', 'proposals/b.md');
      assert.strictEqual(signals.explicit_related, 1);
    });

    it('parses block-style YAML array tags correctly', () => {
      const a = '---\ntitle: Doc A\ntags:\n  - ui\n  - governance\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags:\n  - ui\n  - security\n---\nContent B.';
      const signals = computeSignals(a, b);
      assert.ok(signals.tag_overlap > 0, `tag_overlap should be positive with block-style tags: ${signals.tag_overlap}`);
    });

    it('parses block-style YAML array related_to correctly', () => {
      const a = '---\ntitle: Doc A\ntags: []\nrelated_to:\n  - proposals/b.md\n  - proposals/c.md\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\n---\nContent B.';
      const signals = computeSignals(a, b, 'proposals/a.md', 'proposals/b.md');
      assert.strictEqual(signals.explicit_related, 1);
    });

    it('detects wikilink co-occurrence', () => {
      const a = '---\ntitle: Doc A\ntags: []\n---\nSee also [[common-target.md]] for details.';
      const b = '---\ntitle: Doc B\ntags: []\n---\nReferenced in [[common-target.md]] above.';
      const signals = computeSignals(a, b);
      assert.ok(signals.wikilink_cooccurrence > 0, `wikilink overlap: ${signals.wikilink_cooccurrence}`);
    });

    it('detects same assigned_to', () => {
      const a = '---\ntitle: Doc A\ntags: []\nassigned_to: [NetYeti]\n---\nContent A.';
      const b = '---\ntitle: Doc B\ntags: []\nassigned_to: [NetYeti]\n---\nContent B.';
      const signals = computeSignals(a, b);
      assert.strictEqual(signals.same_assigned, 1);
    });
  });

  describe('computeConfidence', () => {
    it('returns 0 for all-zero signals', () => {
      const s = { jaccard: 0, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      assert.strictEqual(computeConfidence(s), 0);
    });

    it('returns positive for mixed signals', () => {
      const s = { jaccard: 0.3, tag_overlap: 0.5, phase_match: 1, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      const c = computeConfidence(s);
      assert.ok(c > 0.1, `confidence: ${c}`);
      assert.ok(c < 0.8, `confidence should not be max: ${c}`);
    });
  });

  describe('classifyRelationship', () => {
    it('classifies explicit related_to as related_to', () => {
      const s = { jaccard: 0, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 1, wikilink_cooccurrence: 0 };
      assert.strictEqual(classifyRelationship(0.9, s, {}), 'related_to');
    });

    it('classifies high-confidence + high tag overlap as merge_candidate', () => {
      const s = { jaccard: 0.3, tag_overlap: 0.9, phase_match: 1, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      assert.strictEqual(classifyRelationship(0.75, s, {}), 'merge_candidate');
    });

    it('classifies low confidence as parallel', () => {
      const s = { jaccard: 0.05, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      assert.strictEqual(classifyRelationship(0.15, s, {}), 'parallel');
    });

    it('classifies research/ candidate as informed-by regardless of confidence', () => {
      const s = { jaccard: 0.8, tag_overlap: 0.9, phase_match: 1, same_author: 0, same_assigned: 0, explicit_related: 1, wikilink_cooccurrence: 0 };
      assert.strictEqual(classifyRelationship(0.95, s, {}, 'research/sse-vs-websocket.md'), 'informed-by');
    });

    it('classifies research/ candidate as informed-by even at low confidence', () => {
      const s = { jaccard: 0.1, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      assert.strictEqual(classifyRelationship(0.31, s, {}, 'research/some-doc.md'), 'informed-by');
    });

    it('does not classify non-research candidate as informed-by', () => {
      const s = { jaccard: 0.3, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
      assert.notStrictEqual(classifyRelationship(0.4, s, {}, 'proposals/some-proposal.md'), 'informed-by');
    });
  });

  describe('scanProposal', () => {
    it('finds related proposals in a vault', () => {
      const root = makeVault({
        'proposals/target.md': '---\ntitle: Rename document\ntags: [ux, sidebar]\n---\nCannot rename a document in the sidebar. Add inline rename to file tree.',
        'proposals/related.md': '---\ntitle: File rename UX\ntags: [ux, sidebar]\n---\nNo way to rename files from the sidebar. Double-click filename to rename.',
        'proposals/unrelated.md': '---\ntitle: Network topology\ntags: [infra]\n---\nIP addressing for the data centre rack.',
      });
      const results = scanProposal('proposals/target.md', ['proposals/related.md', 'proposals/unrelated.md'], root, 0.1);
      assert.ok(results.length >= 1, 'should find at least one related');
      const related = results.find(r => r.target === 'proposals/related.md');
      assert.ok(related, 'should find related.md');
      assert.ok(related!.confidence > 0.15, `confidence > 0.15: ${related!.confidence}`);
      fs.rmSync(root, { recursive: true });
    });

    it('excludes target from results', () => {
      const root = makeVault({
        'proposals/a.md': '---\ntitle: A\ntags: []\n---\nfoo bar baz',
        'proposals/b.md': '---\ntitle: B\ntags: []\n---\nfoo bar baz',
      });
      const results = scanProposal('proposals/a.md', ['proposals/a.md', 'proposals/b.md'], root, 0);
      assert.ok(!results.some(r => r.target === 'proposals/a.md'), 'should not include target');
      fs.rmSync(root, { recursive: true });
    });

    it('filters by threshold', () => {
      const root = makeVault({
        'proposals/a.md': '---\ntitle: Alpha\ntags: [x]\n---\nThe quick brown fox jumps over the lazy dog.',
        'proposals/b.md': '---\ntitle: Beta\ntags: [x]\n---\nThe quick brown fox jumps over the lazy dog near the bank.',
        'proposals/c.md': '---\ntitle: Gamma\ntags: [y]\n---\nQuantum entanglement in superconducting circuits.',
      });
      const results = scanProposal('proposals/a.md', ['proposals/b.md', 'proposals/c.md'], root, 0.4);
      const high = results.filter(r => r.confidence >= 0.4);
      assert.ok(high.length <= results.length);
      fs.rmSync(root, { recursive: true });
    });
  });

  describe('relationship map I/O', () => {
    it('save and load round-trips', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-map-'));
      const map = {
        generated: '',
        relationships: [{
          source: 'a.md', target: 'b.md', type: 'related_to' as const,
          confidence: 0.8, targetTitle: 'B',
          signals: { jaccard: 0.5, tag_overlap: 0.5, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 },
        }],
      };
      saveRelationshipMap(root, map);
      const loaded = loadRelationshipMap(root);
      assert.strictEqual(loaded.relationships.length, 1);
      assert.strictEqual(loaded.relationships[0].source, 'a.md');
      assert.ok(loaded.generated.length > 0, 'should have generated timestamp');
      fs.rmSync(root, { recursive: true });
    });

    it('load returns empty map for missing file', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-map-'));
      const map = loadRelationshipMap(root);
      assert.strictEqual(map.relationships.length, 0);
      fs.rmSync(root, { recursive: true });
    });
  });

  describe('rebuildRelationships', () => {
    it('scans all proposals and produces map', () => {
      const root = makeVault({
        'proposals/target.md': '---\ntitle: Target\ntags: [ux]\n---\nThe quick brown fox jumps over the lazy dog.',
        'proposals/approved/related.md': '---\ntitle: Approved Related\ntags: [ux]\n---\nThe quick brown fox jumps over the lazy dog near the bank.',
        'proposals/unrelated.md': '---\ntitle: Unrelated\ntags: [infra]\n---\nIP addressing for data centre rack.',
      });
      const map = rebuildRelationships(root, 0.1);
      assert.ok(map.relationships.length > 0, 'should find some relationships');
      assert.ok(map.generated.length > 0, 'should have timestamp');
      // Verify persisted
      const loaded = loadRelationshipMap(root);
      assert.strictEqual(loaded.relationships.length, map.relationships.length);
      fs.rmSync(root, { recursive: true });
    });
  });
});
