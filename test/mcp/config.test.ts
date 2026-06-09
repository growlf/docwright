import * as assert from 'node:assert';
import * as path from 'node:path';
import { loadConfig } from '../../src/mcp/config';

describe('Config parsing', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses fully valid environment', () => {
    process.env.DOCWRIGHT_VAULT_ROOT = '/tmp/vault';
    process.env.DOCWRIGHT_MCP_PORT = '4000';
    process.env.DOCWRIGHT_LOG_LEVEL = 'debug';
    process.env.DOCWRIGHT_PROFILE = 'custom';

    const config = loadConfig();
    assert.strictEqual(config.vaultRoot, path.resolve('/tmp/vault'));
    assert.strictEqual(config.mcpPort, 4000);
    assert.strictEqual(config.logLevel, 'debug');
    assert.strictEqual(config.profile, 'custom');
  });

  it('uses defaults when env vars are missing', () => {
    delete process.env.DOCWRIGHT_VAULT_ROOT;
    delete process.env.DOCWRIGHT_ROOT;
    delete process.env.DOCWRIGHT_MCP_PORT;
    delete process.env.DOCWRIGHT_LOG_LEVEL;
    delete process.env.DOCWRIGHT_PROFILE;

    const config = loadConfig();
    assert.strictEqual(config.vaultRoot, '');
    assert.strictEqual(config.mcpPort, 3100);
    assert.strictEqual(config.logLevel, 'info');
    assert.strictEqual(config.profile, undefined);
  });

  it('falls back to DOCWRIGHT_ROOT if DOCWRIGHT_VAULT_ROOT is missing', () => {
    delete process.env.DOCWRIGHT_VAULT_ROOT;
    process.env.DOCWRIGHT_ROOT = '/tmp/root';
    const config = loadConfig();
    assert.strictEqual(config.vaultRoot, path.resolve('/tmp/root'));
  });

  it('warns and defaults to info on invalid log level', () => {
    process.env.DOCWRIGHT_LOG_LEVEL = 'invalid';
    const config = loadConfig();
    assert.strictEqual(config.logLevel, 'info');
  });

  it('ignores malformed port and uses default', () => {
    process.env.DOCWRIGHT_MCP_PORT = 'not-a-number';
    const config = loadConfig();
    assert.strictEqual(config.mcpPort, 3100);
  });
});
