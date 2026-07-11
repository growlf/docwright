#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = (() => {
  let dir = path.dirname(new URL(import.meta.url).pathname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'VERSION'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();

const COMPLETED_DIR = path.join(ROOT, 'plans', 'completed');
const VERSION_FILE = path.join(ROOT, 'VERSION');

function usage(): never {
  console.log(`Usage: npm run phase:close -- N

Closes phase N: bumps version to 0.\${N+1}.0, commits, tags, and pushes.

Steps:
  1. Validates ≥1 plans/completed/phase-N-*.md file exists with 'status: completed'
     (a presence + status check — does NOT verify each plan's individual steps)
  2. Calculates next version: 0.\${N+1}.0
  3. Checks current version — idempotent if already at or beyond target
  4. Updates VERSION, package.json, and src/webui/package.json
  5. Commits with standard message
  6. Runs npm run release:tag (tags + pushes + watches CI)

Options:
  N     Phase number to close (e.g. 2 for Phase 2)
`);
  process.exit(1);
}

/**
 * Find completed plans belonging to a phase.
 *
 * A plan belongs to phase N if EITHER its filename starts with `phase-N-`
 * (the legacy convention, used by phase-1/2/3 master plans) OR its frontmatter
 * declares `phase: N` (the current convention — most Phase 4+ plans are
 * feature-named, e.g. `ai-model-routing.md` with `phase: 4`). Only plans with
 * `status: completed` count. Exported for unit testing; `dir` is injectable so
 * tests can point at a fixture directory instead of the real plans/completed.
 */
export function findPhasePlans(phase: number, dir: string = COMPLETED_DIR): string[] {
  const prefix = `phase-${phase}-`;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f))
    .filter(fp => {
      try {
        const raw = fs.readFileSync(fp, 'utf-8');
        if (!raw.includes('status: completed')) return false;
        if (path.basename(fp).startsWith(prefix)) return true;
        const m = raw.match(/^phase:\s*(\d+)\s*$/m);
        return m ? Number(m[1]) === phase : false;
      } catch {
        return false;
      }
    });
}

function parseVersion(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function readVersion(): string {
  return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
}

function writeVersion(version: string): void {
  fs.writeFileSync(VERSION_FILE, version + '\n', 'utf-8');

  const pkgPaths = [
    path.join(ROOT, 'package.json'),
    path.join(ROOT, 'src', 'webui', 'package.json'),
  ];
  for (const p of pkgPaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if ('version' in pkg) {
        pkg.version = version;
        fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch {
      // skip malformed
    }
  }

  console.log(`  Updated VERSION → ${version}`);
}

function git(...args: string[]): string {
  const out = execSync(`git ${args.join(' ')}`, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.trim();
}

async function main(): Promise<void> {
  const phase = parseInt(process.argv[2], 10);
  if (!phase || isNaN(phase) || phase < 1) {
    console.error('Error: provide a phase number (e.g. 2 for Phase 2).');
    usage();
  }

  const targetVersion = `0.${phase + 1}.0`;
  const targetTag = `v${targetVersion}`;
  const major = 0;
  const minor = phase + 1;
  const patch = 0;

  console.log(`\n  ── Phase ${phase} Close-out ──`);
  console.log(`  Target version: ${targetVersion}`);
  console.log();

  // Step 1: Validate completed phase plans exist
  const plans = findPhasePlans(phase);
  if (plans.length === 0) {
    console.error(`  Error: no completed plans found matching phase-${phase}-*.md in plans/completed/.`);
    console.error(`  Complete all Phase ${phase} plans before closing the phase.`);
    process.exit(1);
  }
  console.log(`  Found ${plans.length} completed Phase ${phase} plan(s) — OK`);

  // Step 2: Check current version (idempotent)
  const currentVersion = readVersion();
  const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);
  const [tgtMajor, tgtMinor, tgtPatch] = [major, minor, patch];

  if (curMajor > tgtMajor || (curMajor === tgtMajor && curMinor > tgtMinor) ||
      (curMajor === tgtMajor && curMinor === tgtMinor && curPatch >= tgtPatch)) {
    console.log(`  Current version ${currentVersion} is already >= ${targetVersion} — nothing to do.`);
    console.log(`  ✅ Phase ${phase} close-out already applied.`);
    process.exit(0);
  }

  console.log(`  Current version: ${currentVersion} → bumping to ${targetVersion}`);
  console.log();

  // Step 3: Update version files
  writeVersion(targetVersion);

  // Step 4: Commit
  const msg = `chore: bump version to ${targetVersion} — Phase ${phase} complete, Phase ${phase + 1} begins`;
  git('add', 'VERSION', 'package.json');
  const webuiPkg = path.join(ROOT, 'src', 'webui', 'package.json');
  if (fs.existsSync(webuiPkg)) git('add', 'src/webui/package.json');
  git('commit', '-m', `"${msg.replace(/"/g, '\\"')}"`);
  console.log(`  Committed: ${msg}`);
  console.log();

  // Step 5: Tag and push
  console.log(`  Running: npm run release:tag ${targetVersion}`);
  console.log();
  execSync(`npm run release:tag ${targetVersion}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log();
  console.log(`  ✅ Phase ${phase} close-out complete — ${targetTag} released.`);
}

// Only run the release flow when invoked directly (not when imported by a test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('phase:close failed:', err.message);
    process.exit(1);
  });
}
