import assert from 'assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateManifest, scanPlugins } from '../../src/webui/src/lib/server/plugins.js';

// ── validateManifest ──────────────────────────────────────────────────────────

const VALID_RAW = {
  apiVersion: '1',
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '0.1.0',
  description: 'Does stuff',
  icon: '🔌',
};

describe('validateManifest', () => {
  it('accepts a valid minimal manifest', () => {
    const result = validateManifest(VALID_RAW, 'my-plugin');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('errors on missing required fields', () => {
    const result = validateManifest({}, 'my-plugin');
    assert.strictEqual(result.valid, false);
    for (const field of ['apiVersion', 'name', 'displayName', 'version', 'description', 'icon']) {
      assert.ok(
        result.errors.some(e => e.includes(`"${field}"`)),
        `expected error for missing field "${field}"`
      );
    }
  });

  it('errors on unsupported apiVersion', () => {
    const result = validateManifest({ ...VALID_RAW, apiVersion: '99' }, 'my-plugin');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('unsupported apiVersion')));
  });

  it('errors on non-kebab-case name', () => {
    const result = validateManifest({ ...VALID_RAW, name: 'MyPlugin' }, 'my-plugin');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('kebab-case')));
  });

  it('warns when name does not match directory', () => {
    const result = validateManifest(VALID_RAW, 'other-dir');
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes('does not match directory')));
  });

  it('warns on unknown fields (forward-compat)', () => {
    const result = validateManifest({ ...VALID_RAW, futureField: 'x' } as any, 'my-plugin');
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes('"futureField"')));
  });
});

// ── scanPlugins ───────────────────────────────────────────────────────────────

function makeTempVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-plugins-test-'));
  fs.mkdirSync(path.join(dir, 'plugins'));
  return dir;
}

function writePlugin(vaultDir: string, name: string, manifest: object): void {
  const pluginDir = path.join(vaultDir, 'plugins', name);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest));
}

describe('scanPlugins', () => {
  let vaultDir: string;
  const originalVaultRoot = process.env.DOCWRIGHT_VAULT_ROOT;

  beforeEach(() => {
    vaultDir = makeTempVault();
    process.env.DOCWRIGHT_VAULT_ROOT = vaultDir;
  });

  afterEach(() => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
    if (originalVaultRoot === undefined) {
      delete process.env.DOCWRIGHT_VAULT_ROOT;
    } else {
      process.env.DOCWRIGHT_VAULT_ROOT = originalVaultRoot;
    }
  });

  it('returns empty array when plugins dir is absent', () => {
    fs.rmdirSync(path.join(vaultDir, 'plugins'));
    assert.deepStrictEqual(scanPlugins(), []);
  });

  it('loads a valid plugin', () => {
    writePlugin(vaultDir, 'my-plugin', { ...VALID_RAW });
    const plugins = scanPlugins();
    assert.strictEqual(plugins.length, 1);
    assert.strictEqual(plugins[0].manifest.name, 'my-plugin');
  });

  it('skips a plugin with missing required fields — not fatal', () => {
    writePlugin(vaultDir, 'bad-plugin', { apiVersion: '1', name: 'bad-plugin' }); // missing fields
    writePlugin(vaultDir, 'my-plugin', { ...VALID_RAW });
    const plugins = scanPlugins();
    assert.strictEqual(plugins.length, 1, 'invalid plugin must be skipped');
    assert.strictEqual(plugins[0].manifest.name, 'my-plugin');
  });

  it('skips a plugin with unsupported apiVersion — not fatal', () => {
    writePlugin(vaultDir, 'my-plugin', { ...VALID_RAW });
    writePlugin(vaultDir, 'future-plugin', { ...VALID_RAW, name: 'future-plugin', apiVersion: '99' });
    const plugins = scanPlugins();
    assert.strictEqual(plugins.length, 1);
    assert.strictEqual(plugins[0].manifest.name, 'my-plugin');
  });

  it('skips a plugin with malformed JSON — not fatal', () => {
    const pluginDir = path.join(vaultDir, 'plugins', 'broken');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{ not valid json');
    writePlugin(vaultDir, 'my-plugin', { ...VALID_RAW });
    const plugins = scanPlugins();
    assert.strictEqual(plugins.length, 1);
  });

  it('sorts plugins by order field', () => {
    writePlugin(vaultDir, 'b-plugin', { ...VALID_RAW, name: 'b-plugin', order: 200 });
    writePlugin(vaultDir, 'a-plugin', { ...VALID_RAW, name: 'a-plugin', order: 100 });
    const plugins = scanPlugins();
    assert.strictEqual(plugins[0].manifest.name, 'a-plugin');
    assert.strictEqual(plugins[1].manifest.name, 'b-plugin');
  });

  it('applies defaults for omitted optional fields', () => {
    writePlugin(vaultDir, 'my-plugin', { ...VALID_RAW });
    const [plugin] = scanPlugins();
    assert.strictEqual(plugin.manifest.serverEntrypoint, 'server.js');
    assert.strictEqual(plugin.manifest.clientEntrypoint, 'client/bundle.js');
    assert.strictEqual(plugin.manifest.order, 100);
    assert.strictEqual(plugin.manifest.searchable, false);
  });
});
