/**
 * Manages the DocWright MCP entry in opencode.json.
 * Only enables the MCP server if it can actually start — a broken MCP
 * entry causes OpenCode to hang on every message while it retries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { json } from '@sveltejs/kit';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

const MCP_SERVER_PATH = path.join(REPO_ROOT, 'scripts', 'mcp-server.py');
const NODE_MCP_PATH   = path.join(REPO_ROOT, 'dist', 'mcp-server.js');
const OPENCODE_JSON   = path.join(REPO_ROOT, 'opencode.json');

// Prefer venv Python if it exists — that's where project deps are installed
const VENV_PYTHON = path.join(REPO_ROOT, '.venv', 'bin', 'python3');
function getPython(): string {
  return fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
}

type McpStatus = 'python-ok' | 'node-ok' | 'unavailable';

function probeMcpServer(): McpStatus {
  if (fs.existsSync(MCP_SERVER_PATH)) {
    const python = getPython();
    const result = spawnSync(python, ['-c',
      'import importlib.util, sys; sys.exit(0 if importlib.util.find_spec("mcp") else 1)'
    ], { timeout: 3000 });
    if (result.status === 0) return 'python-ok';
  }
  if (fs.existsSync(NODE_MCP_PATH)) return 'node-ok';
  return 'unavailable';
}

function buildMcpEntry(status: McpStatus) {
  if (status === 'python-ok') {
    return {
      type: 'local',
      command: [getPython(), MCP_SERVER_PATH],
      environment: { DOCWRIGHT_ROOT: REPO_ROOT },
      enabled: true,
    };
  }
  if (status === 'node-ok') {
    return {
      type: 'local',
      command: ['node', NODE_MCP_PATH],
      environment: { DOCWRIGHT_ROOT: REPO_ROOT },
      enabled: true,
    };
  }
  // Server not available — register disabled so it doesn't cause hangs
  return {
    type: 'local',
    command: [getPython(), MCP_SERVER_PATH],
    environment: { DOCWRIGHT_ROOT: REPO_ROOT },
    enabled: false,
    _note: 'Disabled: mcp package not found. Run: .venv/bin/pip install mcp',
  };
}

/** GET — status: registered, enabled, mcp server availability */
export function GET() {
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSON)) {
    try { existing = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf-8')); } catch { /* ignore */ }
  }
  const entry = existing?.mcp?.docwright;
  const registered = !!entry;
  const enabled    = registered && entry.enabled === true;
  const mcpStatus  = probeMcpServer();
  return json({ registered, enabled, mcpStatus, mcpServerExists: fs.existsSync(MCP_SERVER_PATH) });
}

/** POST — register MCP entry; enable only if server is actually usable */
export function POST() {
  const mcpStatus = probeMcpServer();
  let existing: Record<string, any> = {};
  if (fs.existsSync(OPENCODE_JSON)) {
    try { existing = JSON.parse(fs.readFileSync(OPENCODE_JSON, 'utf-8')); } catch { /* start fresh */ }
  }

  const merged = {
    ...existing,
    mcp: {
      ...(existing.mcp ?? {}),
      docwright: buildMcpEntry(mcpStatus),
    },
  };

  try {
    fs.writeFileSync(OPENCODE_JSON, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    const ok = mcpStatus !== 'unavailable';
    return json({
      ok,
      registered: true,
      enabled: ok,
      mcpStatus,
      message: ok
        ? 'MCP server registered and enabled'
        : 'MCP server registered but disabled — mcp package not installed (pip install mcp)',
    });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
}
