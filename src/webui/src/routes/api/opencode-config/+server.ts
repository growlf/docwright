/**
 * Reports MCP server availability and registers it in opencode.jsonc.
 * Only enables the entry if the compiled server actually exists — a broken
 * MCP entry causes OpenCode to hang on every message while it retries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const NODE_MCP_PATH  = path.join(REPO_ROOT, 'dist', 'mcp', 'server.js');
const OPENCODE_JSONC = path.join(REPO_ROOT, 'opencode.jsonc');

function mcpServerExists(): boolean {
  return fs.existsSync(NODE_MCP_PATH);
}

function buildMcpEntry(enabled: boolean) {
  return {
    type: 'local',
    command: ['node', NODE_MCP_PATH, '--mode', 'vault'],
    environment: { DOCWRIGHT_VAULT_ROOT: REPO_ROOT },
    enabled,
    ...(!enabled && { _note: 'Disabled: dist/mcp/server.js not found. Run: npm run compile' }),
  };
}

/** GET — status: whether the compiled MCP server exists and is registered */
export function GET() {
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSONC)) {
    try {
      const raw = fs.readFileSync(OPENCODE_JSONC, 'utf-8');
      // Strip JSONC comments before parsing
      const stripped = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      existing = JSON.parse(stripped);
    } catch { /* ignore */ }
  }
  const entry = existing?.mcp?.['dw-mcp'];
  const registered = !!entry;
  const enabled    = registered && entry.enabled === true;
  const compiled   = mcpServerExists();
  return json({ registered, enabled, compiled, mcpServerPath: NODE_MCP_PATH });
}

/** POST — register/refresh the MCP entry; enables only when compiled server exists */
export function POST() {
  const compiled = mcpServerExists();
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSONC)) {
    try {
      const raw = fs.readFileSync(OPENCODE_JSONC, 'utf-8');
      const stripped = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      existing = JSON.parse(stripped);
    } catch { /* start fresh */ }
  }

  const merged = {
    ...existing,
    mcp: {
      ...(existing.mcp ?? {}),
      'dw-mcp': buildMcpEntry(compiled),
    },
  };

  try {
    fs.writeFileSync(OPENCODE_JSONC, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    return json({
      ok: compiled,
      registered: true,
      enabled: compiled,
      compiled,
      message: compiled
        ? 'MCP server registered and enabled'
        : 'MCP server registered but disabled — run: npm run compile',
    });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}
