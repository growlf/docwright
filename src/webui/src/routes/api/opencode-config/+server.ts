/**
 * Ensures opencode.json in the vault root has the DocWright MCP server
 * registered. Merges into any existing config — never overwrites.
 *
 * Called by the ChatPanel on mount so the AI has governance tools
 * available from the first session.
 */

import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const MCP_SERVER_PATH = path.join(REPO_ROOT, 'scripts', 'mcp-server.py');
const OPENCODE_JSON   = path.join(REPO_ROOT, 'opencode.json');

function buildMcpEntry() {
  // Use Python if mcp-server.py exists; fall back to node dist when TypeScript version ships
  const hasPython = fs.existsSync(MCP_SERVER_PATH);
  if (hasPython) {
    return {
      type: 'local',
      command: ['python3', MCP_SERVER_PATH],
      environment: { DOCWRIGHT_ROOT: REPO_ROOT },
      enabled: true,
    };
  }
  // TypeScript MCP server (Phase 2 dispatch module)
  const nodePath = path.join(REPO_ROOT, 'dist', 'mcp-server.js');
  return {
    type: 'local',
    command: ['node', nodePath],
    environment: { DOCWRIGHT_ROOT: REPO_ROOT },
    enabled: true,
  };
}

/** GET — returns current opencode.json content + whether MCP is registered */
export function GET() {
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSON)) {
    try { existing = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf-8')); } catch { /* ignore */ }
  }
  const registered = !!existing?.mcp?.docwright;
  return json({ config: existing, registered, mcpServerExists: fs.existsSync(MCP_SERVER_PATH) });
}

/** POST — merge DocWright MCP entry into opencode.json */
export function POST() {
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSON)) {
    try { existing = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf-8')); } catch { /* start fresh */ }
  }

  const merged = {
    ...existing,
    mcp: {
      ...(existing.mcp ?? {}),
      docwright: buildMcpEntry(),
    },
  };

  try {
    fs.writeFileSync(OPENCODE_JSON, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    return json({ ok: true, registered: true, config: merged });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}
