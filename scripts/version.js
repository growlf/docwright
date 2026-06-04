#!/usr/bin/env node
/**
 * version.js — calculate and optionally update DocWright version.
 *
 * Version format: 0.MINOR.PATCH
 *   MINOR = current active phase number
 *   PATCH = number of plans completed in that phase
 *
 * Usage:
 *   node scripts/version.js           # print current version
 *   node scripts/version.js --update  # update VERSION + package.json
 */

const fs   = require('fs');
const path = require('path');

const REPO_ROOT = (() => {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'plans'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();

const PLANS_DIR = path.join(REPO_ROOT, 'plans');

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (val && !val.startsWith('-')) result[key] = val;
  }
  return result;
}

function calculateVersion() {
  if (!fs.existsSync(PLANS_DIR)) return '0.1.0';

  // Read all non-completed plan files (not in plans/completed/)
  const planFiles = fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(PLANS_DIR, f), 'utf-8');
      return { file: f, fm: parseFrontmatter(raw) };
    })
    .filter(p => p.fm.phase); // only plans with a phase: field

  if (planFiles.length === 0) return '0.1.0';

  // Find the current active phase (lowest phase with any non-completed plan)
  const phaseGroups = {};
  for (const p of planFiles) {
    const ph = parseInt(p.fm.phase, 10);
    if (isNaN(ph)) continue;
    if (!phaseGroups[ph]) phaseGroups[ph] = { completed: 0, total: 0 };
    phaseGroups[ph].total++;
    if (p.fm.status === 'completed') phaseGroups[ph].completed++;
  }

  const phases = Object.keys(phaseGroups).map(Number).sort((a, b) => a - b);
  if (phases.length === 0) return '0.1.0';

  // Current phase = lowest phase that isn't fully complete
  let currentPhase = phases[0];
  for (const ph of phases) {
    const g = phaseGroups[ph];
    if (g.completed < g.total) { currentPhase = ph; break; }
    // If all plans in this phase are done, advance to next
    currentPhase = ph;
  }

  const patch = phaseGroups[currentPhase]?.completed ?? 0;
  return `0.${currentPhase}.${patch}`;
}

function updateVersionFiles(version) {
  // Update VERSION file
  const versionFile = path.join(REPO_ROOT, 'VERSION');
  fs.writeFileSync(versionFile, version + '\n', 'utf-8');

  // Update package.json (only the webui one, not workspace roots without version)
  const pkgPaths = [
    path.join(REPO_ROOT, 'src', 'webui', 'package.json'),
    path.join(REPO_ROOT, 'package.json'),
  ];
  for (const pkgPath of pkgPaths) {
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if ('version' in pkg) {
        pkg.version = version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch { /* skip malformed package.json */ }
  }

  return versionFile;
}

const version = calculateVersion();
console.log(version);

if (process.argv.includes('--update')) {
  updateVersionFiles(version);
  console.error(`Updated: VERSION = ${version}`);
}
