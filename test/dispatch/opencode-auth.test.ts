import assert from 'assert';
import { opencodeHeaders } from '../../src/dispatch/opencode-auth';

describe('opencode-auth — opencodeHeaders()', () => {
  const saved = {
    password: process.env.OPENCODE_SERVER_PASSWORD,
    username: process.env.OPENCODE_SERVER_USERNAME,
  };

  afterEach(() => {
    if (saved.password === undefined) delete process.env.OPENCODE_SERVER_PASSWORD;
    else process.env.OPENCODE_SERVER_PASSWORD = saved.password;
    if (saved.username === undefined) delete process.env.OPENCODE_SERVER_USERNAME;
    else process.env.OPENCODE_SERVER_USERNAME = saved.username;
  });

  it('returns extras unchanged and no Authorization when password is unset', () => {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    delete process.env.OPENCODE_SERVER_USERNAME;
    const h = opencodeHeaders({ 'Content-Type': 'application/json' });
    assert.deepStrictEqual(h, { 'Content-Type': 'application/json' });
  });

  it('returns empty object when no password and no extras', () => {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    assert.deepStrictEqual(opencodeHeaders(), {});
  });

  it('adds Basic auth with default username "opencode" when password is set', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 's3cret';
    delete process.env.OPENCODE_SERVER_USERNAME;
    const h = opencodeHeaders();
    const expected = 'Basic ' + Buffer.from('opencode:s3cret').toString('base64');
    assert.strictEqual(h.Authorization, expected);
  });

  it('honors OPENCODE_SERVER_USERNAME override', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'pw';
    process.env.OPENCODE_SERVER_USERNAME = 'admin';
    const h = opencodeHeaders();
    const expected = 'Basic ' + Buffer.from('admin:pw').toString('base64');
    assert.strictEqual(h.Authorization, expected);
  });

  it('merges Authorization with extra headers without mutating the input', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'pw';
    const extra = { 'Content-Type': 'application/json' };
    const h = opencodeHeaders(extra);
    assert.strictEqual(h['Content-Type'], 'application/json');
    assert.ok(h.Authorization?.startsWith('Basic '));
    assert.deepStrictEqual(extra, { 'Content-Type': 'application/json' });
  });

  it('reads env at call time, not module load', () => {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    assert.strictEqual(opencodeHeaders().Authorization, undefined);
    process.env.OPENCODE_SERVER_PASSWORD = 'late-set';
    assert.ok(opencodeHeaders().Authorization);
  });
});
