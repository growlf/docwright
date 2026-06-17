#!/usr/bin/env tsx
/**
 * scripts/check-vault-atoms.ts
 * Validate and report the policy atom set for any vault.
 * Usage: npm run atoms:check -- --vault /path/to/vault
 *        npm run atoms:check          (checks DocWright's own policies/)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildIndex } from '../src/policy-atoms-core/index-builder.js';
import { syncCheck } from '../src/policy-atoms-core/sync-checker.js';
import { SYNOPSIS_TOKEN_HARD, SYNOPSIS_TOKEN_SOFT } from '../src/policy-atoms-core/schema.js';

function usage() {
  console.log('Usage: npm run atoms:check [-- --vault /path/to/vault]');
  console.log('       Omit --vault to check DocWright\'s own policies/ directory.');
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) usage();

let vaultRoot = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--vault') vaultRoot = path.resolve(args[++i]);
}

const policiesDir = path.join(vaultRoot, 'policies');
const label = vaultRoot === process.cwd() ? 'DocWright (self)' : vaultRoot;

console.log(`\nPolicy atom check: ${label}`);
console.log(`  policies dir: ${policiesDir}`);
console.log(`  limit: ${SYNOPSIS_TOKEN_SOFT} soft / ${SYNOPSIS_TOKEN_HARD} hard\n`);

if (!fs.existsSync(policiesDir)) {
  console.log('  ⚠  No policies/ directory found — vault has no atoms yet.');
  console.log('     Run: npm run adopt -- --dest <vault> --upgrade   to seed pilot atoms.');
  process.exit(0);
}

// Sync-check
const { valid, issues, tokenCount } = syncCheck(policiesDir);
const errors   = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');

// Index summary
const { index } = buildIndex({ policiesDir });
const det  = index.atoms.filter(a => a.kind === 'deterministic');
const judg = index.atoms.filter(a => a.kind === 'judgment');

console.log(`  atoms: ${index.atoms.length} (${det.length} deterministic, ${judg.length} judgment)`);
const tokenBar = tokenCount > SYNOPSIS_TOKEN_HARD ? '🔴' : tokenCount > SYNOPSIS_TOKEN_SOFT ? '🟡' : '🟢';
console.log(`  synopsis index: ${tokenCount} tokens ${tokenBar}  (limit ${SYNOPSIS_TOKEN_HARD})`);
console.log();

// Atom listing
for (const a of index.atoms) {
  const icon = a.kind === 'deterministic' ? '⚙' : '💬';
  console.log(`  ${icon} ${a.id.padEnd(28)} scope: [${a.scope.join(', ')}]`);
}

// Issues
if (errors.length || warnings.length) {
  console.log();
  for (const i of issues) {
    const icon = i.severity === 'error' ? '✗' : '⚠';
    console.log(`  ${icon} ${i.atomId}: ${i.message}`);
  }
}

console.log();
if (valid) {
  console.log(`  ✅ ${index.atoms.length} atoms valid`);
} else {
  console.log(`  ✗ ${errors.length} error(s) — fix before Step 3 retirement`);
  process.exit(1);
}
