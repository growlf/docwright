#!/usr/bin/env npx tsx
/**
 * scripts/backfill-proposal-source.ts
 *
 * Dry-run: finds plans missing proposal_source: and locates their likely
 * source proposal via consumed_by cross-reference.
 *
 * Usage:
 *   npx tsx scripts/backfill-proposal-source.ts          # dry-run (default)
 *   npx tsx scripts/backfill-proposal-source.ts --fix    # apply changes
 *
 * A plan is exempt from the check when:
 *   - It is in plans/completed/
 *   - Its filename starts with "phase-" (phase overview plans)
 *   - Its status is "canceled" or "completed"
 *   - Its proposal_source is set to "none" (intentionally standalone)
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../src/dispatch/frontmatter';

const FIX = process.argv.includes('--fix');
const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..');

function setField(raw: string, field: string, value: string): string {
  if (raw.match(new RegExp(`^${field}:`, 'm'))) {
    return raw.replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: ${value}`);
  }
  // Insert after first --- block
  return raw.replace(/^(---\n[\s\S]*?\n)(---)/, `$1${field}: ${value}\n$2`);
}

// Build reverse index: consumed_by value → proposal path
function buildConsumedByIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const dir of ['proposals', 'proposals/approved', 'proposals/deferred']) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath)) {
      if (!f.endsWith('.md')) continue;
      const filePath = path.join(dirPath, f);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const fm = parseFrontmatter(raw);
      if (fm.consumed_by) {
        const key = String(fm.consumed_by).replace(/\.md$/, '') + '.md';
        index.set(key, path.join(dir, f));
      }
    }
  }
  return index;
}

const consumedByIndex = buildConsumedByIndex();

let found = 0;
let fixed = 0;
let skipped = 0;

const plansDir = path.join(ROOT, 'plans');
for (const f of fs.readdirSync(plansDir)) {
  if (!f.endsWith('.md')) continue;
  if (f.startsWith('phase-')) continue; // phase overview plans are exempt

  const filePath = path.join(plansDir, f);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fm = parseFrontmatter(raw);

  const status = String(fm.status ?? '');
  if (['completed', 'canceled'].includes(status)) continue;

  const src = fm.proposal_source;
  if (src && src !== '') continue; // already set

  found++;
  const planRelPath = `plans/${f}`;
  const sourceProposal = consumedByIndex.get(planRelPath);

  if (sourceProposal) {
    console.log(`[${FIX ? 'fix' : 'dry-run'}] ${planRelPath}`);
    console.log(`  → proposal_source: ${sourceProposal}`);
    if (FIX) {
      const updated = setField(raw, 'proposal_source', sourceProposal);
      fs.writeFileSync(filePath, updated, 'utf-8');
      fixed++;
    }
  } else {
    console.log(`[unresolved] ${planRelPath} — no consumed_by match found`);
    console.log(`  → set proposal_source manually, or 'none' if standalone`);
    skipped++;
  }
}

if (found === 0) {
  console.log('No plans missing proposal_source found.');
} else {
  console.log(`\n${found} plan(s) missing proposal_source.`);
  if (FIX) console.log(`${fixed} fixed, ${skipped} need manual review.`);
  else console.log(`Run with --fix to apply resolved entries. ${skipped} need manual review.`);
}
