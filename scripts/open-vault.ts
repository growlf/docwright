#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

function usage() {
  console.log(`Usage: npm run open -- --vault /path/to/repo

Opens an existing directory in the DocWright Web UI without writing anything
to the target. Sets DOCWRIGHT_ROOT so all file API routes point at the vault.

Options:
  --vault     Path to the directory to open (required)
  --prod      Start in production mode (npm run start) instead of dev
  --help      Show this help
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }

  let vaultPath = '';
  let prod = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault') vaultPath = path.resolve(args[++i]);
    else if (args[i] === '--prod') prod = true;
    else { console.error(`Unknown option: ${args[i]}`); usage(); process.exit(1); }
  }

  if (!vaultPath) { console.error('Error: --vault is required'); usage(); process.exit(1); }
  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    console.error(`Error: ${vaultPath} does not exist or is not a directory`);
    process.exit(1);
  }

  const docwrightPath = process.env.DOCWRIGHT_PATH;
  if (!docwrightPath) {
    console.error('✗ DOCWRIGHT_PATH is not set. Run `direnv allow` in the vault root,');
    console.error('  or export DOCWRIGHT_PATH=/path/to/docwright before running this script.');
    process.exit(1);
  }

  const docwrightRoot = path.resolve(docwrightPath);
  console.log(`\nOpening vault: ${vaultPath}`);
  console.log(`DocWright:     ${docwrightRoot}`);
  console.log(`Mode:          ${prod ? 'production' : 'development'}\n`);

  // Write a session marker (gitignored) so tools can detect which DW install opened the vault
  const markerPath = path.join(vaultPath, '.dw-session.json');
  try {
    fs.writeFileSync(markerPath, JSON.stringify({
      opened_by: docwrightRoot,
      opened_at: new Date().toISOString(),
      pid: process.pid,
    }, null, 2) + '\n', 'utf8');
  } catch { /* non-fatal — vault may be read-only */ }

  const cmd = prod ? 'npm run start' : 'npm run dev';

  execSync(cmd, {
    cwd: docwrightRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DOCWRIGHT_ROOT: vaultPath,
      DOCWRIGHT_VAULT_ROOT: vaultPath,
    },
  });
}

main();
