/**
 * OpenCode process manager — server-only singleton.
 * Tracks whether we spawned opencode serve or found it already running,
 * and ensures we only kill what we own.
 */

import { spawn, type ChildProcess } from 'node:child_process';

export type OCStatus = 'stopped' | 'starting' | 'running-ours' | 'running-external';

let proc: ChildProcess | null = null;
let _status: OCStatus = 'stopped';
let _startLog: string[] = [];

const OPENCODE_BASE = process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096';

export function getStatus(): OCStatus { return _status; }
export function getLog(): string[] { return [..._startLog]; }

async function isRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OPENCODE_BASE}/global/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch { return false; }
}

export async function startOpenCode(): Promise<{ ok: boolean; status: OCStatus; message: string }> {
  // Already running externally?
  if (await isRunning()) {
    _status = 'running-external';
    return { ok: true, status: _status, message: 'OpenCode already running (not started by DocWright)' };
  }

  // Already starting/running from a previous call
  if (_status === 'starting' || _status === 'running-ours') {
    return { ok: true, status: _status, message: 'Already in progress' };
  }

  _status = 'starting';
  _startLog = [];

  const child = spawn('opencode', ['serve'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  proc = child;

  child.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) _startLog.push(line);
  });
  child.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) _startLog.push(line);
  });
  child.on('error', (e) => {
    _startLog.push('Error: ' + e.message);
    _status = 'stopped';
    proc = null;
  });
  child.on('exit', (code) => {
    _startLog.push(`Process exited (${code})`);
    if (_status !== 'stopped') _status = 'stopped';
    proc = null;
  });

  // Poll until healthy or timeout (15s)
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 600));
    if (await isRunning()) {
      _status = 'running-ours';
      return { ok: true, status: _status, message: 'OpenCode started' };
    }
    // Process died before becoming healthy
    if (!proc) {
      _status = 'stopped';
      return { ok: false, status: _status, message: 'OpenCode failed to start. Check PATH.' };
    }
  }

  // Timeout — it may still be starting; leave status as 'starting'
  return { ok: false, status: _status, message: 'OpenCode is taking longer than expected to start' };
}

export function stopOpenCode(): void {
  if (!proc) return;
  try { proc.kill('SIGTERM'); } catch { /* already gone */ }
  proc = null;
  _status = 'stopped';
}

// ── Cleanup hooks ─────────────────────────────────────────────────────────

// Only auto-kill what we own — never kill an external process
function cleanup() {
  if (_status === 'running-ours' || _status === 'starting') stopOpenCode();
}

process.on('exit', cleanup);
process.on('SIGINT',  () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// HMR: kill child when this module is replaced by Vite hot-reload
// so dev reloads don't leave orphaned processes
if (import.meta.hot) {
  import.meta.hot.dispose(cleanup);
}
