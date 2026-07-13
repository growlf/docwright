/**
 * phase-close-core.ts — surface-agnostic phase close-out logic.
 *
 * Shared by the CLI (`scripts/phase-close.ts`) and the Web-UI endpoint
 * (`/api/phase/close`) so the version math + plan-completeness check live in ONE
 * place (harden… code-over-memory; phase-close-web-ui Constraint 2 — no
 * reimplemented version math per surface).
 *
 * Pure fs/path — no git, no tag/push, no MCP, no VS Code deps. Tagging/pushing a
 * release stays a deliberate, human-invoked step in the CLI / by the BDFL.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Version = [number, number, number];

export function parseVersion(v: string): Version {
  const p = v.replace(/^v/, '').trim().split('.').map(Number);
  return [p[0] || 0, p[1] || 0, p[2] || 0];
}

/** The version a phase-N close bumps to: 0.{N+1}.0. */
export function nextPhaseVersion(phase: number): string {
  return `0.${phase + 1}.0`;
}

/** True if `current` is at or beyond `target` (close-out is then a no-op). */
export function isAtOrBeyond(current: string, target: string): boolean {
  const [cM, cm, cp] = parseVersion(current);
  const [tM, tm, tp] = parseVersion(target);
  if (cM !== tM) return cM > tM;
  if (cm !== tm) return cm > tm;
  return cp >= tp;
}

/**
 * A plan belongs to phase N if its filename starts with `phase-N-` (legacy) OR
 * its frontmatter declares `phase: N`. Only `status: completed` plans count.
 */
function planIsPhase(raw: string, basename: string, phase: number): boolean {
  if (basename.startsWith(`phase-${phase}-`)) return true;
  const m = raw.match(/^phase:\s*(\d+)\s*$/m);
  return m ? Number(m[1]) === phase : false;
}

/** Completed plans (basenames) belonging to `phase`, from plans/completed/. */
export function findPhasePlans(phase: number, completedDir: string): string[] {
  if (!fs.existsSync(completedDir)) return [];
  return fs.readdirSync(completedDir)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      try {
        const raw = fs.readFileSync(path.join(completedDir, f), 'utf-8');
        return raw.includes('status: completed') && planIsPhase(raw, f, phase);
      } catch { return false; }
    });
}

/** Non-completed plans (basenames) belonging to `phase`, still in plans/. */
export function findPendingPhasePlans(phase: number, plansDir: string): string[] {
  if (!fs.existsSync(plansDir)) return [];
  return fs.readdirSync(plansDir)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      try {
        const raw = fs.readFileSync(path.join(plansDir, f), 'utf-8');
        if (raw.match(/^status:\s*completed\s*$/m) || raw.match(/^status:\s*canceled\s*$/m)) return false;
        return planIsPhase(raw, f, phase);
      } catch { return false; }
    });
}

export interface PhaseReadiness {
  phase: number;
  ready: boolean;
  completed: string[];
  pending: string[];
  /** True if VERSION is already at/beyond 0.{N+1}.0 — the close was already applied. */
  alreadyClosed: boolean;
}

/**
 * Is phase N ready to close? Ready = ≥1 completed plan AND no pending ones AND the
 * version has not already moved past this phase. The last clause keeps the readiness
 * signal (the "needs attention" panel) in agreement with closePhase()'s own
 * isAtOrBeyond guard — otherwise the panel nags to close a phase the version already
 * passed while the Close action refuses it as "already applied" (dogfood bug 2026-07-13).
 */
export function phaseReadiness(root: string, phase: number): PhaseReadiness {
  const completed = findPhasePlans(phase, path.join(root, 'plans', 'completed'));
  const pending = findPendingPhasePlans(phase, path.join(root, 'plans'));
  let alreadyClosed = false;
  try {
    const current = fs.readFileSync(path.join(root, 'VERSION'), 'utf-8').trim();
    alreadyClosed = isAtOrBeyond(current, nextPhaseVersion(phase));
  } catch { /* no VERSION → treat as not-closed */ }
  return {
    phase,
    ready: completed.length > 0 && pending.length === 0 && !alreadyClosed,
    completed,
    pending,
    alreadyClosed,
  };
}

/** Write `version` to VERSION + package.json + src/webui/package.json. Returns changed paths (relative). */
export function bumpVersionFiles(root: string, version: string): string[] {
  const changed: string[] = [];
  const versionFile = path.join(root, 'VERSION');
  fs.writeFileSync(versionFile, version + '\n', 'utf-8');
  changed.push('VERSION');
  for (const rel of ['package.json', path.join('src', 'webui', 'package.json')]) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if ('version' in pkg) {
        pkg.version = version;
        fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        changed.push(rel.replace(/\\/g, '/'));
      }
    } catch { /* skip malformed */ }
  }
  return changed;
}

export interface ClosePhaseResult {
  ok: boolean;
  reason?: string;
  version?: string;
  changed?: string[];
  completedPlans?: string[];
  /** The explicit, human-invoked tag/push step — NEVER auto-fired here. */
  tagCommand?: string;
}

/**
 * Close phase N: validate all phase-N plans are completed, then bump the version
 * files to 0.{N+1}.0. Does NOT commit, tag, or push — the caller (CLI or a human
 * following tagCommand) owns that deliberate step.
 */
export function closePhase(root: string, phase: number): ClosePhaseResult {
  if (!phase || phase < 1) return { ok: false, reason: 'Provide a phase number ≥ 1.' };
  const { completed, pending } = phaseReadiness(root, phase);
  if (completed.length === 0) {
    return { ok: false, reason: `No completed Phase ${phase} plans found in plans/completed/.` };
  }
  // Version-already-past check comes BEFORE the pending check so an already-closed
  // phase reports "already applied", not a confusing "0 plans still open".
  const target = nextPhaseVersion(phase);
  const current = fs.readFileSync(path.join(root, 'VERSION'), 'utf-8').trim();
  if (isAtOrBeyond(current, target)) {
    return { ok: false, reason: `Version ${current} is already at or beyond ${target} — Phase ${phase} close-out already applied.` };
  }
  if (pending.length > 0) {
    return { ok: false, reason: `Phase ${phase} has ${pending.length} plan(s) still open: ${pending.join(', ')}. Complete or cancel them first.` };
  }
  const changed = bumpVersionFiles(root, target);
  return {
    ok: true,
    version: target,
    changed,
    completedPlans: completed,
    tagCommand: `git tag v${target} && git push origin v${target}`,
  };
}
