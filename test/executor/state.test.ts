import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { acquireLock, releaseLock, writeCheckpoint, readCheckpoint, removeCheckpoint } from '../../src/executor/state.ts';

describe('state', () => {
  const planName = 'test-plan';
  const lockPath = path.join('.docwright', 'executor-locks', 'test-plan.lock');
  const cpPath = path.join('.docwright', 'executor-checkpoints', 'test-plan.json');

  beforeEach(() => {
    if (fs.existsSync(lockPath)) fs.rmdirSync(lockPath);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  after(() => {
    if (fs.existsSync(lockPath)) fs.rmdirSync(lockPath);
    if (fs.existsSync(cpPath)) fs.unlinkSync(cpPath);
  });

  it('acquires and releases a lock', () => {
    assert.strictEqual(acquireLock(planName), true, 'First acquisition should succeed');
    assert.strictEqual(fs.existsSync(lockPath), true, 'Lock directory should exist');
    assert.strictEqual(acquireLock(planName), false, 'Second acquisition should fail');
    
    releaseLock(planName);
    assert.strictEqual(fs.existsSync(lockPath), false, 'Lock directory should be removed');
    assert.strictEqual(acquireLock(planName), true, 'Re-acquisition should succeed');
  });

  it('writes and reads checkpoints', () => {
    const cp = {
      current_step: 2,
      session_id: 'sess_123',
      started_at: new Date().toISOString(),
    };
    
    writeCheckpoint(planName, cp);
    const read = readCheckpoint(planName);
    assert.deepStrictEqual(read, cp, 'Read checkpoint should match written one');
  });

  it('removes checkpoints', () => {
    writeCheckpoint(planName, { current_step: 1, session_id: 'abc', started_at: 'now' });
    assert.strictEqual(fs.existsSync(cpPath), true);
    removeCheckpoint(planName);
    assert.strictEqual(fs.existsSync(cpPath), false);
  });

  it('handles names with dangerous characters', () => {
    const dangerousName = 'foo/bar?baz';
    const safeLockPath = path.join('.docwright', 'executor-locks', 'foo-bar-baz.lock');
    
    try {
      assert.strictEqual(acquireLock(dangerousName), true);
      assert.strictEqual(fs.existsSync(safeLockPath), true);
    } finally {
      releaseLock(dangerousName);
      if (fs.existsSync(safeLockPath)) fs.rmdirSync(safeLockPath);
    }
  });
});
