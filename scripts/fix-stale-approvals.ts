#!/usr/bin/env tsx
/**
 * Fix stale approved proposals not yet moved to proposals/approved/.
 *
 * Finds proposals/*.md files with `approved: true` that are still in the
 * proposals/ root rather than proposals/approved/. By default runs as a
 * dry-run listing. Pass --fix to move files via git mv.
 *
 * Usage:
 *   npx tsx scripts/fix-stale-approvals.ts          # dry-run
 *   npx tsx scripts/fix-stale-approvals.ts --fix    # move files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { parseFrontmatter } from '../src/dispatch/vault-index';

const REPO_ROOT = process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
const PROPOSALS_DIR = path.join(REPO_ROOT, 'proposals');
const APPROVED_DIR = path.join(REPO_ROOT, 'proposals', 'approved');

const fix = process.argv.includes('--fix');

function updatePath(filePath: string, newPath: string): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const updated = raw.replace(/^(_path:\s*).*$/m, `$1${newPath}`);
  fs.writeFileSync(filePath, updated, 'utf-8');
}

function main(): void {
  const entries = fs.readdirSync(PROPOSALS_DIR, { withFileTypes: true });
  const stale: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const fullPath = path.join(PROPOSALS_DIR, entry.name);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const fm = parseFrontmatter(raw);
    if (fm['approved'] === true || fm['approved'] === 'true') {
      stale.push(entry.name);
    }
  }

  if (stale.length === 0) {
    console.log('✅ No stale approved proposals found.');
    return;
  }

  for (const name of stale) {
    const src = path.join('proposals', name);
    const dest = path.join('proposals', 'approved', name);
    if (fix) {
      execSync(`git mv "${src}" "${dest}"`, { cwd: REPO_ROOT, stdio: 'inherit' });
      const destFull = path.join(REPO_ROOT, dest);
      updatePath(destFull, dest);
      console.log(`[moved]   ${src} → ${dest}`);
    } else {
      console.log(`[dry-run] ${src} → ${dest}`);
    }
  }

  if (!fix) {
    console.log(`\n${stale.length} file(s) would be moved. Run with --fix to apply.`);
    console.log('  npm run lifecycle:fix-approvals -- --fix');
  }
}

main();
