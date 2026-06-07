import { strict as assert } from 'assert';
import { writeAuditEntry, readAllEntries, queryAudit } from '../../src/dispatch/audit';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Use a truly isolated temp directory for audit log testing
const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-audit-test-'));
const TEST_AUDIT_DIR = path.join(TEST_ROOT, 'audit');
const TEST_AUDIT_FILE = path.join(TEST_AUDIT_DIR, 'lifecycle.jsonl');

describe('Audit module', () => {
  before(() => {
    process.env.DOCWRIGHT_ROOT = TEST_ROOT;
  });

  after(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    delete process.env.DOCWRIGHT_ROOT;
  });

  beforeEach(() => {
    // Clean audit log between tests
    if (fs.existsSync(TEST_AUDIT_FILE)) fs.unlinkSync(TEST_AUDIT_FILE);
  });

  describe('writeAuditEntry', () => {
    it('writes an entry to the JSONL file', () => {
      writeAuditEntry({
        doc_path: 'proposals/test.md',
        transition_from: 'draft',
        transition_to: 'approved',
        actor: 'NetYeti',
        actor_type: 'human',
      });

      const entries = readAllEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].doc_path, 'proposals/test.md');
      assert.equal(entries[0].transition_to, 'approved');
    });

    it('includes gate info when provided', () => {
      writeAuditEntry({
        doc_path: 'plans/test.md',
        transition_from: 'in-progress',
        transition_to: 'completed',
        actor: 'NetYeti',
        actor_type: 'ai',
        gate_id: 'plan-complete',
        gate_status: 'approved',
      });

      const entries = readAllEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].gate_id, 'plan-complete');
      assert.equal(entries[0].gate_status, 'approved');
    });
  });

  describe('queryAudit', () => {
    beforeEach(() => {
      // Seed test data
      writeAuditEntry({ doc_path: 'plans/a.md', transition_from: 'draft', transition_to: 'approved', actor: 'Alice', actor_type: 'human' });
      writeAuditEntry({ doc_path: 'plans/b.md', transition_from: 'approved', transition_to: 'in-progress', actor: 'Bob', actor_type: 'human' });
      writeAuditEntry({ doc_path: 'plans/c.md', transition_from: 'in-progress', transition_to: 'completed', actor: 'AI-agent', actor_type: 'ai', gate_id: 'plan-complete', gate_status: 'approved' });
    });

    it('returns all entries with no filter', () => {
      const result = queryAudit({});
      assert.equal(result.total, 3);
    });

    it('filters by doc_path', () => {
      const result = queryAudit({ doc_path: 'plans/a' });
      assert.equal(result.total, 1);
      assert.equal(result.entries[0].doc_path, 'plans/a.md');
    });

    it('filters by actor_type', () => {
      const result = queryAudit({ actor_type: 'ai' });
      assert.equal(result.total, 1);
    });

    it('filters by transition_to', () => {
      const result = queryAudit({ transition_to: 'completed' });
      assert.equal(result.total, 1);
    });

    it('filters by gate_id', () => {
      const result = queryAudit({ gate_id: 'plan-complete' });
      assert.equal(result.total, 1);
    });
  });
});
