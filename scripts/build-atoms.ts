#!/usr/bin/env tsx
/**
 * scripts/build-atoms.ts
 * Compiles every policies/<atom>/check.ts → check.js using esbuild.
 * Run before tests or deployment: npm run build:atoms
 *
 * Output format: ESM (required — resolver uses await import())
 * External: all imports in check.ts are bundled inline so check.js is
 * self-contained and works in adopted vaults that lack src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const POLICIES_DIR = path.resolve(process.cwd(), 'policies');

if (!fs.existsSync(POLICIES_DIR)) {
  console.log('No policies/ directory found — nothing to build.');
  process.exit(0);
}

const atomDirs = fs.readdirSync(POLICIES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

let built = 0;
let skipped = 0;
const errors: string[] = [];

for (const dir of atomDirs) {
  const checkTs = path.join(POLICIES_DIR, dir, 'check.ts');
  const checkJs = path.join(POLICIES_DIR, dir, 'check.js');

  if (!fs.existsSync(checkTs)) { skipped++; continue; }

  try {
    execSync(
      `npx esbuild "${checkTs}" --bundle --format=esm --platform=node --outfile="${checkJs}"`,
      { stdio: 'pipe' },
    );
    // Prepend a comment so the file is clearly machine-generated
    const existing = fs.readFileSync(checkJs, 'utf8');
    fs.writeFileSync(checkJs, `// Generated from check.ts by npm run build:atoms — do not edit manually.\n${existing}`, 'utf8');
    console.log(`  ✓ ${dir}/check.js`);
    built++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${dir}/check.ts failed: ${msg}`);
    errors.push(dir);
  }
}

console.log(`\nbuild:atoms — ${built} compiled, ${skipped} skipped (no check.ts), ${errors.length} failed`);
if (built > 0) {
  console.log('  ℹ  check.js files are intentionally committed (adopted vaults have no build step).');
  console.log('     Stage and commit the updated check.js files after running build:atoms.');
}
if (errors.length > 0) process.exit(1);
