import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadProfile, getActiveProfile } from '../../src/dispatch/profile';

function makeTempVault(profileJson?: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-test-'));
  if (profileJson) fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profileJson));
  return dir;
}

describe('Profile engine', () => {
  it('loadProfile returns null when no profile.json', () => {
    const root = makeTempVault();
    assert.strictEqual(loadProfile(root), null);
    fs.rmdirSync(root);
  });

  it('loadProfile returns parsed profile when file exists', () => {
    const custom = { name: 'test', version: '1.0.0', documentTypes: ['proposal'] };
    const root = makeTempVault(custom);
    const result = loadProfile(root);
    assert.ok(result);
    assert.strictEqual(result.name, 'test');
    assert.deepStrictEqual(result.documentTypes, ['proposal']);
    fs.rmSync(root, { recursive: true });
  });

  it('getActiveProfile falls back to org-operations when no profile.json', () => {
    const root = makeTempVault();
    const profile = getActiveProfile(root);
    assert.ok(profile);
    assert.ok(typeof profile.name === 'string');
    assert.ok(Array.isArray(profile.documentTypes));
    assert.ok(profile.documentTypes.length > 0);
    fs.rmdirSync(root);
  });

  it('getActiveProfile returns custom profile when present', () => {
    const custom = {
      docwrightProfileVersion: '1', name: 'custom', displayName: 'Custom', description: 'test',
      version: '0.1.0', documentTypes: ['widget'], states: {}, requiredFrontmatter: [],
      optionalFrontmatter: [], features: {},
    };
    const root = makeTempVault(custom);
    const profile = getActiveProfile(root);
    assert.strictEqual(profile.name, 'custom');
    assert.deepStrictEqual(profile.documentTypes, ['widget']);
    fs.rmSync(root, { recursive: true });
  });
});
