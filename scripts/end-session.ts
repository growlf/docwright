#!/usr/bin/env tsx
/**
 * end-session.ts — automated DocWright session shutdown.
 *
 * Does the deterministic parts of the `endsession` skill in code instead of by
 * hand: resolves identity, collects the session's commits and status, runs the
 * phase close-out gate, writes a session note, appends to SESSION-LOG.md, then
 * commits and pushes outstanding work across every worktree.
 *
 * The model only supplies judgement (focus / summary / decisions / next steps)
 * via flags; everything else is computed. With no flags it still runs end to
 * end, deriving the focus and summary from the session's commits.
 *
 * Usage:
 *   npm run session:end                                 # fully automatic
 *   npm run session:end -- --focus "version + launcher work"
 *   npm run session:end -- --focus "X" --summary "..." --next "..." --next "..."
 *
 * Options:
 *   --focus <text>          2-5 word session focus (default: derived)
 *   --summary <text>        narrative summary (default: derived from commits)
 *   --decision <text>       a key decision; repeatable
 *   --next <text>           a next-session action item; repeatable
 *   --since <date>          override session-start date (default: last log entry)
 *   --defer-phase-close     acknowledge and skip the phase close-out BLOCKING gate
 *   --no-commit             write docs but do not commit
 *   --no-push               commit but do not push
 *   --dry-run               report intended actions; change nothing
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = (() => {
  let dir = path.dirname(new URL(import.meta.url).pathname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'VERSION'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
})();

// Files never auto-committed by endsession (secrets + machine-local churn).
const DENYLIST = ['.env', '.env.local', '.gemini/settings.json'];

// ── tiny output helpers ─────────────────────────────────────────────────────
const c = (n: string, s: string) => `\x1b[${n}m${s}\x1b[0m`;
const log = (s = '') => console.log(`  ${s}`);
const ok = (s: string) => console.log(`  ${c('32', '✓')} ${s}`);
const warn = (s: string) => console.log(`  ${c('33', '!')} ${s}`);
const hdr = (s: string) => console.log(`\n  ${c('1;36', s)}`);
const die = (s: string): never => { console.error(`  ${c('31', '✗')} ${s}`); process.exit(1); };

// ── git helpers ─────────────────────────────────────────────────────────────
function git(args: string[], cwd = ROOT): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}
function gitTry(args: string[], cwd = ROOT): string {
  try { return git(args, cwd); } catch { return ''; }
}

// ── arg parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv: string[]) {
  const opts = {
    focus: '', summary: '', since: '',
    decisions: [] as string[], next: [] as string[],
    deferPhaseClose: false, commit: true, push: true, dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined) die(`${a} requires a value`); return v; };
    switch (a) {
      case '--focus': opts.focus = val(); break;
      case '--summary': opts.summary = val(); break;
      case '--since': opts.since = val(); break;
      case '--decision': opts.decisions.push(val()); break;
      case '--next': opts.next.push(val()); break;
      case '--defer-phase-close': opts.deferPhaseClose = true; break;
      case '--no-commit': opts.commit = false; break;
      case '--no-push': opts.push = false; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h':
        console.log('Usage: npm run session:end -- [--focus ..] [--summary ..] [--decision ..]* [--next ..]* [--defer-phase-close] [--no-commit] [--no-push] [--dry-run]');
        process.exit(0); break;
      default: die(`unknown option: ${a}`);
    }
  }
  return opts;
}

// ── frontmatter (minimal, single-line scalars) ──────────────────────────────
function frontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// ── time helpers ────────────────────────────────────────────────────────────
function stamps(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const compact = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
  return { date, compact };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const now = new Date();
  const { date, compact } = stamps(now);

  // 1. identity
  const human = gitTry(['config', 'user.name']) || 'unknown';
  const email = gitTry(['config', 'user.email']) || 'unknown';
  const machine = os.hostname();
  const branch = gitTry(['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';

  hdr('DocWright — end session');
  log(`${human} <${email}> @ ${machine}  (branch ${branch})`);

  // 2. last-session date + commits this session
  const logRaw = fs.existsSync(path.join(ROOT, 'SESSION-LOG.md'))
    ? fs.readFileSync(path.join(ROOT, 'SESSION-LOG.md'), 'utf-8') : '';
  let since = opts.since;
  if (!since) {
    // Most recent logged session, regardless of file ordering (ISO dates sort lexically).
    const dates = [...logRaw.matchAll(/##\s*Session:\s*(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]).sort();
    since = dates.length ? dates[dates.length - 1] : new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  }
  const commits = gitTry(['log', '--oneline', '--all', `--since=${since} 00:00`]);
  const commitLines = commits ? commits.split('\n') : [];
  log(`since ${since}: ${commitLines.length} commit(s)`);

  // 3. phase close-out gate
  const completedDir = path.join(ROOT, 'plans', 'completed');
  const changedFiles = gitTry(['log', '--name-only', '--pretty=format:', `--since=${since} 00:00`]).split('\n');
  const phaseNums = new Set<number>();
  for (const f of changedFiles) {
    const mm = f.match(/plans\/completed\/phase-(\d+)-.*\.md$/);
    if (mm && fs.existsSync(path.join(ROOT, f))) phaseNums.add(parseInt(mm[1], 10));
  }
  const versionRaw = fs.existsSync(path.join(ROOT, 'VERSION'))
    ? fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf-8').trim() : '0.0.0';
  const minor = parseInt(versionRaw.split('.')[1] || '0', 10);
  for (const n of phaseNums) {
    if (minor <= n) {
      warn(`Phase ${n} plan completed this session but VERSION is ${versionRaw} (not bumped past ${n}).`);
      if (!opts.deferPhaseClose) {
        die(`Run \`npm run phase:close -- ${n}\` first, or re-run with --defer-phase-close to skip.`);
      }
      warn(`Deferred phase-close gate (--defer-phase-close).`);
    }
  }

  // 4. derive focus + summary if not supplied
  const cleanSubject = (l: string) => l.replace(/^[0-9a-f]+\s+/, '').replace(/\s*\(#\d+\)$/, '');
  const subjects = commitLines.map(cleanSubject).filter(s => !/^docs: session note/.test(s));
  const focus = opts.focus || (subjects[0] ? subjects[0].replace(/^\w+:\s*/, '').slice(0, 50) : branch);
  const summary = opts.summary
    || (subjects.length ? `Session work:\n${subjects.slice(0, 8).map(s => `- ${s}`).join('\n')}` : 'No commits this session.');

  // 5. active plans
  const plansDir = path.join(ROOT, 'plans');
  const activePlans: { name: string; status: string; priority: string }[] = [];
  if (fs.existsSync(plansDir)) {
    for (const f of fs.readdirSync(plansDir).filter(f => f.endsWith('.md'))) {
      const fm = frontmatter(fs.readFileSync(path.join(plansDir, f), 'utf-8'));
      if (['in-progress', 'approved'].includes(fm.status)) {
        activePlans.push({ name: f.replace(/\.md$/, ''), status: fm.status, priority: fm.priority || '-' });
      }
    }
  }

  // status across worktrees
  const worktrees = gitTry(['worktree', 'list', '--porcelain'])
    .split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice('worktree '.length));
  const statusNow = gitTry(['status', '--short']);

  // 6. build session note
  const decisionsBlock = opts.decisions.length
    ? opts.decisions.map(d => `- ${d}`).join('\n') : '- (none recorded)';
  const nextBlock = opts.next.length
    ? opts.next.map(n => `- ${n}`).join('\n')
    : '- Review open PRs and active plans below.';
  const plansTable = activePlans.length
    ? `| Plan | Status | Priority |\n|------|--------|----------|\n${activePlans.map(p => `| ${p.name} | ${p.status} | ${p.priority} |`).join('\n')}`
    : '_No active (in-progress/approved) plans._';

  const note = `# Session Note: ${date} — ${focus}

**Date:** ${date}
**Author:** ${human} @ ${machine}
**Focus:** ${focus}

## Summary

${summary}

## Decisions Made

${decisionsBlock}

## Active Plans

${plansTable}

## Commits This Session

\`\`\`
${commits || '(none)'}
\`\`\`

## Uncommitted Changes (at session end)

\`\`\`
${statusNow || '(clean)'}
\`\`\`

## Next Session Should Start With

${nextBlock}
`;

  const notesDir = path.join(ROOT, 'docs', 'session-notes');
  const notePath = path.join(notesDir, `session_note_${compact}.md`);
  const logEntry = `\n---\n\n## Session: ${date} — ${focus}\n\n**Focus:** ${focus}\n\n**Completed:**\n${subjects.slice(0, 10).map(s => `- [x] ${s}`).join('\n') || '- [x] (see session note)'}\n\n**Session note:** \`docs/session-notes/session_note_${compact}.md\`\n`;

  if (opts.dryRun) {
    hdr('DRY RUN — no files written, no git actions');
    log(`would write: ${path.relative(ROOT, notePath)}`);
    log(`would append SESSION-LOG.md entry for: ${focus}`);
    log(`worktrees: ${worktrees.join(', ') || ROOT}`);
    log(`commit: ${opts.commit}   push: ${opts.push}`);
    console.log('\n' + note);
    return;
  }

  // 7. write docs
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(notePath, note, 'utf-8');
  ok(`wrote ${path.relative(ROOT, notePath)}`);
  fs.appendFileSync(path.join(ROOT, 'SESSION-LOG.md'), logEntry, 'utf-8');
  ok('appended SESSION-LOG.md');

  // 8. commit + push per worktree
  if (!opts.commit) { warn('skipped commit (--no-commit)'); printReport(); return; }

  const msgFile = path.join(os.tmpdir(), `dw-session-${compact}.txt`);
  fs.writeFileSync(msgFile, `docs: session note ${date} — ${focus}\n`, 'utf-8');

  const pushed: string[] = [];
  const committed: string[] = [];
  for (const wt of worktrees.length ? worktrees : [ROOT]) {
    const dirty = gitTry(['status', '--short'], wt);
    if (!dirty) continue;
    git(['add', '-A'], wt);
    for (const denied of DENYLIST) {
      gitTry(['reset', '-q', '--', denied], wt);  // never commit secrets / machine churn
    }
    const staged = gitTry(['diff', '--cached', '--name-only'], wt);
    if (!staged) { warn(`${path.basename(wt)}: nothing to commit after denylist`); continue; }
    git(['commit', '-F', msgFile], wt);
    committed.push(path.basename(wt));
    ok(`${path.basename(wt)}: committed ${staged.split('\n').length} file(s)`);

    if (!opts.push) continue;
    const wtBranch = gitTry(['rev-parse', '--abbrev-ref', 'HEAD'], wt);
    const hasUpstream = gitTry(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], wt);
    try {
      if (hasUpstream) git(['push', 'origin', wtBranch], wt);
      else git(['push', '-u', 'origin', wtBranch], wt);
      pushed.push(`${path.basename(wt)}:${wtBranch}`);
      ok(`pushed ${wtBranch}`);
    } catch {
      warn(`push failed for ${wtBranch} — push manually`);
    }
  }
  fs.rmSync(msgFile, { force: true });

  if (!committed.length) warn('no worktree had changes to commit');
  printReport(pushed);

  function printReport(pushedBranches: string[] = []) {
    hdr('Session ended');
    log(`note:    ${path.relative(ROOT, notePath)}`);
    log(`pushed:  ${pushedBranches.length ? pushedBranches.join(', ') : '(nothing / --no-push)'}`);
    if (activePlans.length) {
      log('active plans:');
      for (const p of activePlans) log(`  - ${p.name} (${p.status}, prio ${p.priority})`);
    }
    if (opts.next.length) {
      log('next session:');
      for (const n of opts.next.slice(0, 3)) log(`  - ${n}`);
    }
    console.log();
  }
}

// Run only when invoked directly (e.g. `npm run session:end`), never on import.
// This prevents an accidental `import('./end-session.ts')` from committing/pushing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
