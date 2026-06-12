import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadProfile, getActiveProfile, mergeProfiles, MergeError } from '../../src/dispatch/profile';

const BUNDLED: any = {
  docwrightProfileVersion: '1',
  name: 'org-operations',
  displayName: 'Org Operations',
  description: 'Default profile',
  version: '0.1.0',
  documentTypes: ['proposal', 'plan', 'policy'],
  states: { proposal: ['draft', 'active'], plan: ['draft', 'active', 'completed'] },
  requiredFrontmatter: ['type', 'status', 'created', 'author', 'author-role'],
  optionalFrontmatter: ['tags', 'category'],
  features: { wikilinks: true, graph: true },
  effortSizes: { XS: '~1d', S: '~3d' },
  gates: [
    { id: 'plan-complete', trigger: 'status-transition', reviewers: ['steward'] },
  ],
};

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

  it('getActiveProfile falls back to bundled when no profile.json', () => {
    const root = makeTempVault();
    const profile = getActiveProfile(root);
    assert.ok(profile);
    assert.ok(typeof profile.name === 'string');
    assert.ok(Array.isArray(profile.documentTypes));
    assert.ok(profile.documentTypes.length > 0);
    fs.rmdirSync(root);
  });

  it('getActiveProfile merges vault override onto bundled', () => {
    const vaultOverride = {
      name: 'custom-vault',
      requiredFrontmatter: ['+client-id'],
    };
    const root = makeTempVault(vaultOverride);
    const profile = getActiveProfile(root);
    assert.strictEqual(profile.name, 'custom-vault');
    // documentTypes should retain all bundled values (merge preserved them)
    assert.ok(profile.documentTypes.includes('proposal'));
    assert.ok(profile.documentTypes.includes('plan'));
    assert.ok(profile.documentTypes.includes('policy'));
    // requiredFrontmatter should have bundled defaults + appended item
    assert.ok(profile.requiredFrontmatter.includes('type'));
    assert.ok(profile.requiredFrontmatter.includes('client-id'));
    fs.rmSync(root, { recursive: true });
  });
});

describe('mergeProfiles', () => {
  it('scalar replace: vault name overrides bundled name', () => {
    const result = mergeProfiles(BUNDLED, { name: 'my-vault' });
    assert.strictEqual(result.name, 'my-vault');
  });

  it('object deep-merge: vault keys supplement bundled keys', () => {
    const result = mergeProfiles(BUNDLED, {
      effortSizes: { M: '~1w' },
    });
    assert.strictEqual(result.effortSizes.XS, '~1d');  // bundled preserved
    assert.strictEqual(result.effortSizes.M, '~1w');    // vault added
  });

  it('+array append: vault items appended to bundled array', () => {
    const result = mergeProfiles(BUNDLED, {
      requiredFrontmatter: ['+client-id', 'account-manager'],
    });
    assert.ok(result.requiredFrontmatter.includes('type'));        // bundled
    assert.ok(result.requiredFrontmatter.includes('client-id'));    // appended
    assert.ok(result.requiredFrontmatter.includes('account-manager')); // appended
  });

  it('unprefixed array replace: vault replaces bundled entirely', () => {
    const result = mergeProfiles(BUNDLED, {
      documentTypes: ['widget', 'gadget'],
    });
    assert.deepStrictEqual(result.documentTypes, ['widget', 'gadget']);
  });

  it('+prefix on non-array field throws MergeError', () => {
    assert.throws(() => {
      mergeProfiles(BUNDLED, { name: ['+should-not-work'] });
    }, MergeError);
  });

  it('type mismatch: vault string vs bundled object throws MergeError', () => {
    assert.throws(() => {
      mergeProfiles(BUNDLED, { effortSizes: 'not-an-object' });
    }, MergeError);
  });

  it('type mismatch: vault object vs bundled scalar throws MergeError', () => {
    assert.throws(() => {
      mergeProfiles(BUNDLED, { name: { nested: 'object' } });
    }, MergeError);
  });

  it('unknown field passes through with warning', () => {
    const result = mergeProfiles(BUNDLED, { customField: 'anything' });
    assert.strictEqual((result as any).customField, 'anything');
  });

  it('object deep-merge: nested gate object is supplemented', () => {
    const result = mergeProfiles(BUNDLED, {
      gates: [
        { id: 'custom-gate', trigger: 'manual', reviewers: ['contributor'] },
      ],
    });
    assert.strictEqual(result.gates.length, 1);
    assert.strictEqual(result.gates[0].id, 'custom-gate');
  });
});
