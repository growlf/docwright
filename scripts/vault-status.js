#!/usr/bin/env node
/**
 * vault-status — print current vault workflow state to stdout.
 * Pure filesystem scan, no AI tokens, no network calls.
 * Called by: Claude Code /status skill, OpenCode rules, CI, shell.
 *
 * Usage: node scripts/vault-status.js [--json]
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = process.env.DOCWRIGHT_ROOT || path.resolve(__dirname, '..');
const asJson = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// Frontmatter parser — strings, booleans, block arrays
// ---------------------------------------------------------------------------
function parseFm(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const result = {}, lines = m[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const ci = lines[i].indexOf(':');
    if (ci <= 0) { i++; continue; }
    const key  = lines[i].slice(0, ci).trim();
    const rest = lines[i].slice(ci + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      const arr = [];
      while (i < lines.length && /^\s+-\s/.test(lines[i]))
        arr.push(lines[i++].replace(/^\s+-\s*/, '').trim());
      result[key] = arr;
      continue;
    }
    let v = rest.replace(/^["']|["']$/g, '');
    if (v === 'true') v = true; else if (v === 'false') v = false;
    result[key] = v;
    i++;
  }
  return result;
}

function scanDir(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const fm  = parseFm(raw);
        return { file: f, path: path.join(rel, f), title: String(fm.title || f.replace(/\.md$/, '')), fm };
      } catch { return null; }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Collect data
// ---------------------------------------------------------------------------
const allProposals = scanDir('proposals');
const allApproved  = scanDir('proposals/approved');
const allPlans     = scanDir('plans');
const allCompleted = scanDir('plans/completed');

const planSources = new Set(
  [...allPlans, ...allCompleted].flatMap(p => {
    const s = p.fm.proposal_source;
    return Array.isArray(s) ? s : s ? [String(s)] : [];
  })
);

const open = allProposals.filter(p =>
  p.fm.approved !== true &&
  p.fm.deferred !== true &&
  !p.file.includes('misc')
);

const deferred = allProposals.filter(p => p.fm.deferred === true);

const approvedPending = allApproved.filter(p =>
  !planSources.has(p.path) &&
  !p.file.includes('phase-0-spike-decision')
);

const active = allPlans.filter(p =>
  ['approved', 'in-progress'].includes(String(p.fm.status || ''))
);

const result = {
  proposals: {
    open:             open.map(p => ({ path: p.path, title: p.title, complexity: p.fm.complexity || '', category: p.fm.category || [] })),
    approved_pending: approvedPending.map(p => ({ path: p.path, title: p.title })),
    deferred:         deferred.map(p => ({ path: p.path, title: p.title })),
  },
  plans: {
    active:          active.map(p => ({ path: p.path, title: p.title, status: p.fm.status || '', priority: p.fm.priority || '', assigned_to: p.fm.assigned_to || '' })),
    completed_count: allCompleted.length,
  },
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

function section(title, items, fmt) {
  console.log(`\n${title} (${items.length})`);
  if (items.length === 0) { console.log('  (none)'); return; }
  items.forEach(i => console.log('  ' + fmt(i)));
}

console.log('=== Vault Status ===');
section('Open proposals',          result.proposals.open,             p => `- ${p.title}${p.complexity ? ' [' + p.complexity + ']' : ''}`);
section('Active plans',            result.plans.active,               p => `- [${p.status}] ${p.title}${p.priority ? ' (' + p.priority + ')' : ''}`);
section('Approved — awaiting plan', result.proposals.approved_pending, p => `- ${p.title}`);
console.log(`\nCompleted plans: ${result.plans.completed_count}`);
if (result.proposals.deferred.length)
  section('Deferred', result.proposals.deferred, p => `- ${p.title}`);
