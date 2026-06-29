#!/usr/bin/env node
/**
 * plan-health — scan active plans for governance health warnings.
 *
 * Checks:
 *   1. Approved plans with placeholder steps (no filled Action cells)
 *   2. In-progress plans with TBD testing plan
 *   3. Keyword overlap between in-progress and approved plans (Jaccard >= threshold)
 *
 * Usage: node scripts/plan-health.js [--json] [--threshold 0.12]
 * Exit: 0 = clean, 1 = warnings found
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = process.env.DOCWRIGHT_ROOT || path.resolve(__dirname, '..');
const asJson    = process.argv.includes('--json');
const threshIdx = process.argv.indexOf('--threshold');
const THRESHOLD = threshIdx >= 0 ? parseFloat(process.argv[threshIdx + 1]) : 0.12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFm(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const result = {};
  for (const line of m[1].split('\n')) {
    const ci = line.indexOf(':');
    if (ci <= 0) continue;
    const key = line.slice(0, ci).trim();
    const val = line.slice(ci + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = val === 'true' ? true : val === 'false' ? false : val;
  }
  return result;
}

function extractSection(text, header) {
  const re = new RegExp(`^## ${header}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n*$)`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

const TESTING_PLACEHOLDERS = new Set([
  '_testing plan tbd_',
  '_add test plan during implementation._',
  '{{value:testing}}',
]);

function testingPlanIsTbd(text) {
  const section = extractSection(text, 'Testing Plan').toLowerCase();
  return section === '' || TESTING_PLACEHOLDERS.has(section);
}

function hasPlaceholderSteps(text) {
  const lines = text.split('\n');
  let inSection = false;
  let dataRowCount = 0;
  let filledCount = 0;
  let actionColIdx = -1;
  let headerFound = false;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      actionColIdx = -1;
      headerFound = false;
      continue;
    }
    if (!inSection || !line.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(line)) continue;

    const parts = line.split('|');
    const cells = parts.slice(1, parts.length - 1).map(c => c.trim());

    if (!headerFound) {
      const aIdx = cells.findIndex(c => /^action$/i.test(c));
      if (aIdx >= 0) { actionColIdx = aIdx; headerFound = true; continue; }
      const firstNum = parseInt(cells[0], 10);
      if (firstNum > 0) {
        dataRowCount++;
        const action = cells[1] ?? '';
        if (action !== '' && action !== '-' && action !== '—') filledCount++;
      }
      continue;
    }

    const firstNum = parseInt(cells[0], 10);
    if (!(firstNum > 0)) continue;
    dataRowCount++;
    const action = actionColIdx >= 0 ? (cells[actionColIdx] ?? '') : (cells[1] ?? '');
    if (action !== '' && action !== '-' && action !== '—') filledCount++;
  }

  return dataRowCount === 0 || filledCount === 0;
}

// ---------------------------------------------------------------------------
// Tokenize + Jaccard for overlap detection
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','have','has','had','do','does',
  'did','will','would','could','should','may','might','not','no','if','then',
  'that','this','it','its','they','them','we','you','all','each','some','other',
  'only','about','after','before','plan','step','status','pending','done',
]);

function tokenize(text) {
  const words = text.toLowerCase().match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) || [];
  return new Set(words.filter(w => !STOP_WORDS.has(w)));
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function scanPlans(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      try {
        const fullPath = path.join(dir, f);
        const text = fs.readFileSync(fullPath, 'utf8');
        const fm = parseFm(text);
        return { file: f, path: path.join('plans', f), title: fm.title || f.replace(/\.md$/, ''), status: fm.status || '', text };
      } catch { return null; }
    })
    .filter(Boolean);
}

const plansDir = path.join(ROOT, 'plans');
const plans = scanPlans(plansDir);

const approved   = plans.filter(p => p.status === 'approved');
const inProgress = plans.filter(p => p.status === 'in-progress');

const warnings = [];

// Check 1: approved plans with placeholder steps
for (const p of approved) {
  if (hasPlaceholderSteps(p.text)) {
    warnings.push({ type: 'placeholder-steps', plan: p.path, title: p.title, status: p.status,
      message: `Approved but has placeholder steps — fill Action cells before starting work` });
  }
}

// Check 2: in-progress plans with TBD testing
for (const p of inProgress) {
  if (testingPlanIsTbd(p.text)) {
    warnings.push({ type: 'tbd-testing', plan: p.path, title: p.title, status: p.status,
      message: `In-progress but Testing Plan is TBD — write a real testing plan` });
  }
}

// Check 3: keyword overlap between in-progress and approved
const ipTokens = inProgress.map(p => ({ ...p, tokens: tokenize(p.text) }));
const apTokens = approved.map(p => ({ ...p, tokens: tokenize(p.text) }));

for (const ip of ipTokens) {
  for (const ap of apTokens) {
    const score = jaccard(ip.tokens, ap.tokens);
    if (score >= THRESHOLD) {
      warnings.push({ type: 'keyword-overlap', planA: ip.path, planB: ap.path,
        titleA: ip.title, titleB: ap.title,
        score: Math.round(score * 100) / 100,
        message: `Overlap score ${Math.round(score * 100)}% — verify these aren't covering the same scope` });
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (asJson) {
  console.log(JSON.stringify({ warnings }, null, 2));
  process.exit(warnings.length > 0 ? 1 : 0);
}

if (warnings.length === 0) {
  console.log('✅ Plan health: no issues found');
  process.exit(0);
}

console.log(`⚠  Plan health warnings (${warnings.length}):\n`);
for (const w of warnings) {
  if (w.type === 'keyword-overlap') {
    console.log(`  [overlap ${w.score}] ${w.titleA}  ↔  ${w.titleB}`);
    console.log(`           ${w.planA}  ↔  ${w.planB}`);
    console.log(`           ${w.message}`);
  } else {
    console.log(`  [${w.type}] ${w.title}  (${w.plan})`);
    console.log(`           ${w.message}`);
  }
  console.log();
}
process.exit(1);
