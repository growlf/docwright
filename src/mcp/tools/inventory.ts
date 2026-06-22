import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getRepoRoot } from '../lib/paths';

const SCRIPT = 'scripts/sync-device-inventory.py';

function runScript(scriptArgs: string[], timeoutMs = 30_000): { ok: boolean; text: string } {
  const root = getRepoRoot();
  const scriptPath = path.join(root, SCRIPT);

  if (!fs.existsSync(scriptPath)) {
    return {
      ok: false,
      text:
        `${SCRIPT} not found in vault root (${root}).\n` +
        `Ensure DOCWRIGHT_ROOT points to the bms-ai-cluster vault.`,
    };
  }

  try {
    const stdout = execFileSync('python3', [scriptPath, ...scriptArgs], {
      cwd: root,
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: { ...process.env },
    });
    return { ok: true, text: stdout.trim() };
  } catch (err: any) {
    const combined =
      (err.stdout?.trim() ?? '') +
      (err.stderr ? `\nSTDERR:\n${err.stderr.trim()}` : '');
    return { ok: false, text: combined || String(err.message) };
  }
}

export function syncDeviceInventory(environment: string, mode: string, source = 'yaml'): string {
  const { ok, text } = runScript(['--env', environment, '--mode', mode, '--source', source]);
  return ok ? text : `Error running sync:\n${text}`;
}

export function scaffoldDeviceInventory(
  envId: string,
  name: string,
  subnet?: string,
  gateway?: string,
): string {
  const args = ['--env', 'new', '--name', name, '--env-id', envId];
  if (subnet)  args.push('--subnet', subnet);
  if (gateway) args.push('--gateway', gateway);
  const { ok, text } = runScript(args);
  return ok ? text : `Error scaffolding environment:\n${text}`;
}

export function listDeviceInventories(): string {
  const root = getRepoRoot();
  const refDir = path.join(root, 'docs', 'reference');

  if (!fs.existsSync(refDir)) {
    return `docs/reference/ not found in vault (${root}).`;
  }

  const rows: string[] = [];

  for (const entry of fs.readdirSync(refDir).sort()) {
    if (!entry.endsWith('-devices')) continue;
    const dir = path.join(refDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;

    const notes = fs.readdirSync(dir).filter(f => f.endsWith('.md')).length;
    const hasConfig = fs.existsSync(path.join(dir, 'base-view.yml'));
    const hasBase   = fs.existsSync(path.join(dir, 'index.base'));

    rows.push(
      `  ${entry.padEnd(32)} ${notes} notes` +
      `  config:${hasConfig ? '✓' : '✗'}` +
      `  index.base:${hasBase ? '✓' : '✗'}`,
    );
  }

  if (!rows.length) return 'No *-devices folders found in docs/reference/.';
  return `Device inventories in ${root}:\n\n${rows.join('\n')}`;
}
