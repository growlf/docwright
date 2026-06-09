#!/usr/bin/env node
/**
 * lifecycle-gate — validate and log lifecycle state transitions.
 *
 * Called by: .githooks/pre-commit, future MCP server, CI.
 * This module is the single source of truth for lifecycle gate logic.
 *
 * Usage:
 *   node scripts/lifecycle-gate.js --status          → print current vault state
 *   node scripts/lifecycle-gate.js --check <file>    → validate a file's state
 *   node scripts/lifecycle-gate.js --audit           → print recent audit log
 *   node scripts/lifecycle-gate.js --json            → --status as JSON
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = process.env.DOCWRIGHT_ROOT || path.resolve(__dirname, '..');
const AUDIT_LOG = path.join(ROOT, '.docwright', 'audit.jsonl');

// ---------------------------------------------------------------------------
// Frontmatter parser
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
      result[key] = arr; continue;
    }
    let v = rest.replace(/^["']|["']$/g, '');
    if (v === 'true') v = true; else if (v === 'false') v = false;
    result[key] = v; i++;
  }
  return result;
}

function readFm(filePath) {
  try {
    return parseFm(fs.readFileSync(path.join(ROOT, filePath), 'utf8'));
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
function logTransition(entry) {
  const dir = path.join(ROOT, '.docwright');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    ...entry,
    ts: new Date().toISOString(),
    host: process.env.HOSTNAME || require('os').hostname(),
  });
  fs.appendFileSync(AUDIT_LOG, line + '\n');
}

function readAuditLog(limit = 20) {
  if (!fs.existsSync(AUDIT_LOG)) return [];
  return fs.readFileSync(AUDIT_LOG, 'utf8')
    .trim().split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean).slice(-limit);
}

// ---------------------------------------------------------------------------
// Transition validators
// ---------------------------------------------------------------------------

/**
 * Validate that a proposal being moved to proposals/approved/ was approved
 * by a human (not self-approved by an agent).
 *
 * Returns { ok: boolean, error?: string }
 */
function checkSelfApproval(file, oldFm, newFm) {
  if (!file.startsWith('proposals/approved/')) return { ok: true };
  if (newFm.approved !== true) return { ok: true };
  if (oldFm && oldFm.approved === true) return { ok: true }; // already approved, just editing

  // New approval: check HUMAN_APPROVED env
  if (process.env.HUMAN_APPROVED === '1') return { ok: true };

  return {
    ok: false,
    error: `${file}: 'approved' set to true — only humans may approve proposals.\n` +
           `  If this was intentional, commit with: HUMAN_APPROVED=1 git commit ...`,
  };
}

/**
 * Validate that a new plan file references an approved proposal.
 */
function checkPlanHasSource(file, fm) {
  if (!file.startsWith('plans/') || file.startsWith('plans/completed/')) return { ok: true };
  const sources = Array.isArray(fm.proposal_source)
    ? fm.proposal_source
    : fm.proposal_source ? [fm.proposal_source] : [];
  if (sources.length === 0) {
    return {
      ok: false,
      error: `${file}: plan is missing 'proposal_source' — every plan must trace to an approved proposal`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pending step enforcement (Deliverables 2 & 3)
// ---------------------------------------------------------------------------

/**
 * State-machine section scanner — no dependencies, no full-file regex.
 *
 * Returns true if the content has ⏳ in a table row inside either:
 *   - The "## Implementation Steps" section, OR
 *   - Any "### Task / Deliverable ... ✅" subsection
 *
 * Scoped tightly: ⏳ in prose, code blocks outside these sections is ignored.
 */
function hasPendingStepsInSection(content) {
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    // Major section header (##) — enter Implementation Steps, leave anything else
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      continue;
    }
    // Task/deliverable subsection (###) — enter if marked ✅, leave otherwise
    if (/^###\s/.test(line)) {
      inSection = /✅/.test(line);
      continue;
    }
    if (!inSection) continue;
    // Inside a relevant section: flag any pipe-table row containing ⏳
    if (line.startsWith('|') && line.includes('⏳')) return true;
  }
  return false;
}

/**
 * Count the number of completed step rows in the Implementation Steps section.
 */
function countCompletedStepsInSection(content) {
  const lines = content.split('\n');
  let inSection = false;
  let count = 0;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      continue;
    }
    if (!inSection) continue;
    
    // Only count data rows that contain ✅ (ignore header/separator)
    if (line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| ---') && line.includes('✅')) {
      count++;
    }
  }
  return count;
}

/**
 * Block a plan from being committed with status:completed while any pending
 * steps remain. In-progress plans with mixed done/pending rows are normal
 * and are not flagged.
 */
function checkPendingSteps(file, fm) {
  if (!file.startsWith('plans/') || file.startsWith('plans/completed/')) return { ok: true };
  if (String(fm.status) !== 'completed') return { ok: true };

  let raw;
  try { raw = fs.readFileSync(path.join(ROOT, file), 'utf8'); }
  catch { return { ok: true }; }

  if (!hasPendingStepsInSection(raw)) return { ok: true };

  return { ok: false, error: `${file}: status=completed but pending rows remain in Implementation Steps.\n  Mark all step rows done before completing this plan.` };
}

/**
 * Ensure the completed_steps frontmatter field matches the actual count of completed rows.
 */
function checkStepCounterConsistency(file, fm) {
  if (!file.startsWith('plans/')) return { ok: true };
  if (fm.completed_steps === undefined) return { ok: true };

  let raw;
  try { raw = fs.readFileSync(path.join(ROOT, file), 'utf8'); }
  catch { return { ok: true }; }

  // Only run if an Implementation Steps section exists
  if (!/^##\s+Implementation Steps\b/im.test(raw)) return { ok: true };

  const actualCount = countCompletedStepsInSection(raw);
  const declaredCount = Number(fm.completed_steps);

  if (actualCount !== declaredCount) {
    return { ok: false, error: `${file}: completed_steps frontmatter (${declaredCount}) does not match the actual number of ✅ rows in the Implementation Steps table (${actualCount}).` };
  }

  return { ok: true };
}

/**
 * Validate a lifecycle file before commit.
 * Returns array of { ok, error } objects.
 */
function validateFile(file, oldFm, newFm) {
  const results = [];
  results.push(checkSelfApproval(file, oldFm, newFm));
  if (file.startsWith('plans/') && !file.startsWith('plans/completed/')) {
    results.push(checkPlanHasSource(file, newFm));
    results.push(checkPendingSteps(file, newFm));
  }
  if (file.startsWith('plans/')) {
    results.push(checkStepCounterConsistency(file, newFm));
  }
  return results;
}


// ---------------------------------------------------------------------------
// Status summary (mirrors vault-status.js but focused on gate-relevant info)
// ---------------------------------------------------------------------------
function getStatus() {
  function scan(rel) {
    const dir = path.join(ROOT, rel);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
      const fm = readFm(path.join(rel, f));
      return { file: f, path: path.join(rel, f), fm };
    }).filter(e => e.fm);
  }

  const plans = scan('plans');
  const activePlans = plans.filter(p => ['approved', 'in-progress'].includes(String(p.fm.status || '')));
  const openProposals = scan('proposals').filter(p => !p.fm.approved && !p.fm.deferred && !p.file.includes('misc'));

  return {
    hasActivePlan: activePlans.length > 0,
    activePlans: activePlans.map(p => ({ path: p.path, title: p.fm.title, status: p.fm.status })),
    openProposals: openProposals.length,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--status') || args.includes('--json')) {
    const status = getStatus();
    if (args.includes('--json')) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log('=== Lifecycle Gate Status ===');
      console.log('Active plans:', status.hasActivePlan ? status.activePlans.length : 'NONE ⚠');
      status.activePlans.forEach(p => console.log('  [' + p.status + '] ' + p.title));
      console.log('Open proposals:', status.openProposals);
    }
  } else if (args.includes('--audit')) {
    const entries = readAuditLog(30);
    if (entries.length === 0) { console.log('No audit log entries.'); }
    else entries.forEach(e => console.log(e.ts, e.event, e.file || '', e.user || ''));
  } else if (args.includes('--check')) {
    const file = args[args.indexOf('--check') + 1];
    if (!file) { console.error('--check requires a file path'); process.exit(1); }
    const fm = readFm(file);
    if (!fm) { console.error('Could not read frontmatter from', file); process.exit(1); }
    const results = validateFile(file, null, fm);
    const errors = results.filter(r => !r.ok);
    if (errors.length === 0) {
      console.log('OK:', file);
    } else {
      errors.forEach(e => console.error('ERROR:', e.error));
      process.exit(1);
    }
  } else if (args.includes('--check-files')) {
    // Efficient multi-file check — one Node.js invocation for all staged plan files
    const files = args.slice(args.indexOf('--check-files') + 1).filter(a => !a.startsWith('--'));
    let anyError = false;
    for (const file of files) {
      const fm = readFm(file);
      if (!fm) continue;
      const results = validateFile(file, null, fm);
      const errors = results.filter(r => !r.ok);
      if (errors.length > 0) {
        errors.forEach(e => console.error('ERROR:', e.error));
        anyError = true;
      }
    }
    if (anyError) process.exit(1);
  } else {
    console.log('Usage: node scripts/lifecycle-gate.js [--status|--audit|--check <file>|--check-files <file...>|--json]');
  }
}

module.exports = { validateFile, checkSelfApproval, checkPlanHasSource, checkPendingSteps, hasPendingStepsInSection, logTransition, readAuditLog, getStatus };
