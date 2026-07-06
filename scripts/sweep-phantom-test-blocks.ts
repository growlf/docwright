/**
 * Sweep archived plans for phantom Testing Plan step duplicates (#148).
 *
 * The unconditional syncTestCriteria-on-save re-injected unchecked
 * `- [ ] Step N: ...` lines into Testing Plans whose steps had been reworded
 * — duplicating steps that already carry a checked `- [x] Step N:` line.
 * This removes exactly those duplicates from plans/completed/ (and can be
 * pointed at plans/ with --active for a pre-archive sweep).
 *
 * Usage: npx tsx scripts/sweep-phantom-test-blocks.ts [--dry-run] [--active]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { removePhantomStepDuplicates } from '../src/dispatch/test-criteria';

const ROOT = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const dir = process.argv.includes('--active')
  ? path.join(ROOT, 'plans')
  : path.join(ROOT, 'plans', 'completed');

let touched = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.md')) continue;
  const full = path.join(dir, f);
  if (!fs.statSync(full).isFile()) continue;
  const raw = fs.readFileSync(full, 'utf-8');
  const { content, removed } = removePhantomStepDuplicates(raw);
  if (removed.length === 0) continue;
  touched++;
  console.log(`${path.relative(ROOT, full)} — ${removed.length} phantom line(s):`);
  for (const line of removed) console.log(`  ${line}`);
  if (!dryRun) fs.writeFileSync(full, content, 'utf-8');
}
console.log(`${dryRun ? '[dry-run] ' : ''}${touched} file(s) ${dryRun ? 'would be' : ''} cleaned.`);
