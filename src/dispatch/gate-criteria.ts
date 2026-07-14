/**
 * gate-criteria.ts — parse + resolve verified plan-completion gate criteria.
 *
 * Part of the "verified gate criteria" plan (step 1). A gate criterion is a CLAIM with an
 * optional inline `verify:` binding that says how to confirm it, instead of a bare checkbox
 * the completion gate trusts on sight. This module is the PURE core: it parses the criteria
 * out of a plan's Phase Gate / Gate Criteria section and resolves each against supplied
 * evidence into {tier, satisfied, reason}. It has NO filesystem, exec, MCP, or VS Code deps —
 * filesystem checks are supplied via an injected predicate, and command/file results are read
 * from a recorded-evidence map (populated by the step-3 recorder). Wiring into
 * checkCompletionGate happens in step 2; this step changes no behaviour.
 *
 * Inline grammar (one criterion per checklist line):
 *
 *   - [ ] (id) Claim text — verify: <check>
 *
 * where <check> is one of:
 *   tests_pass                 — the recorded test run is green (tier 1, machine-derived)
 *   steps_done                 — no pending implementation steps (tier 1)
 *   frontmatter:<field>=<val>  — a plan frontmatter field equals a value (tier 1)
 *   file_exists:<path>         — a repo path exists (tier 1; via injected predicate / recorded)
 *   cmd:<name>                 — a whitelisted named check exited 0 (tier 1; recorded by step 3)
 *   human                      — pure human judgement (tier 3; requires an attestation)
 *   human+<check>              — human attests AND <check> is not false (tier 2, cross-checked)
 *
 * A criterion with NO `verify:` suffix — or a malformed one — is treated as UNBOUND: today's
 * legacy behaviour, satisfied only when the box is checked `[x]`. Unbound is the safe default.
 */

export type GateTier = 1 | 2 | 3;

export type MachineCheckKind =
  | 'tests_pass'
  | 'steps_done'
  | 'frontmatter'
  | 'file_exists'
  | 'cmd';

export interface MachineCheck {
  kind: MachineCheckKind;
  field?: string; // frontmatter
  value?: string; // frontmatter
  path?: string; // file_exists
  cmd?: string; // cmd
  raw: string;
}

export type GateBinding =
  | ({ kind: MachineCheckKind } & MachineCheck) // tier 1
  | { kind: 'human'; raw: string } // tier 3
  | { kind: 'human_check'; check: MachineCheck; raw: string }; // tier 2

export interface GateCriterion {
  id: string | null;
  text: string;
  checked: boolean;
  binding: GateBinding | null; // null ⇒ unbound (legacy)
  rawLine: string;
}

/** Recorded / injected evidence a criterion is resolved against. All fields optional. */
export interface GateEvidence {
  /** Parsed plan frontmatter (tests_last_result, tests_human_reviewed, …). */
  frontmatter?: Record<string, unknown>;
  /** Whether the plan still has pending implementation steps (for steps_done). */
  hasPendingSteps?: boolean;
  /** Recorded cmd/file_exists results keyed by criterion id (populated by the step-3 recorder). */
  gateEvidence?: Record<string, { satisfied: boolean; detail?: string; at?: string; ts?: string }>;
  /** Recorded human attestations keyed by criterion id (populated by the step-4 recorder). */
  attestations?: Record<string, { by: string; role?: string; ts?: string; commit?: string; note?: string }>;
  /** Injected filesystem predicate for file_exists (keeps this module pure). */
  fileExists?: (path: string) => boolean;
}

export interface CriterionResult {
  tier: GateTier;
  satisfied: boolean;
  reason: string;
}

/** A recorded evidence entry for one criterion (written by the step-3 recorder). */
export interface EvidenceEntry {
  satisfied: boolean;
  detail: string;
  at?: string; // commit the check ran against
  ts?: string; // ISO timestamp
}

/** Injected effects for LIVE evaluation (running the checks), kept out of this pure module. */
export interface LiveEffects {
  frontmatter?: Record<string, unknown>;
  hasPendingSteps?: boolean;
  fileExists?: (path: string) => boolean;
  /** Runs a whitelisted named command; returns null when the name is not allowed. */
  runCmd?: (name: string) => { satisfied: boolean; detail: string } | null;
}

const CHECKBOX_LINE = /^\s*-\s*\[( |x|X)\]\s*(?:\(([^)]+)\)\s*)?(.*?)\s*$/;
// A verify binding is separated from the claim by an em dash or a double hyphen.
const VERIFY_SUFFIX = /\s*(?:—|--)\s*verify:\s*(\S.*?)\s*$/;

/**
 * Parse a single `verify:` payload into a MachineCheck. Returns null on anything unrecognised
 * so the caller can fall back to unbound (legacy) — a malformed binding must never silently
 * pass a gate.
 */
function parseMachineCheck(spec: string): MachineCheck | null {
  const raw = spec.trim();
  if (raw === 'tests_pass') return { kind: 'tests_pass', raw };
  if (raw === 'steps_done') return { kind: 'steps_done', raw };
  if (raw.startsWith('frontmatter:')) {
    const rest = raw.slice('frontmatter:'.length);
    const eq = rest.indexOf('=');
    if (eq <= 0) return null;
    const field = rest.slice(0, eq).trim();
    const value = rest.slice(eq + 1).trim();
    if (!field || value === '') return null;
    return { kind: 'frontmatter', field, value, raw };
  }
  if (raw.startsWith('file_exists:')) {
    const path = raw.slice('file_exists:'.length).trim();
    return path ? { kind: 'file_exists', path, raw } : null;
  }
  if (raw.startsWith('cmd:')) {
    const cmd = raw.slice('cmd:'.length).trim();
    return cmd ? { kind: 'cmd', cmd, raw } : null;
  }
  return null;
}

/** Parse a full `verify:` payload (machine check, `human`, or `human+<check>`) into a binding. */
export function parseBinding(spec: string): GateBinding | null {
  const raw = spec.trim();
  if (raw === 'human') return { kind: 'human', raw };
  if (raw.startsWith('human+')) {
    const check = parseMachineCheck(raw.slice('human+'.length));
    return check ? { kind: 'human_check', check, raw } : null;
  }
  const mc = parseMachineCheck(raw);
  return mc ? ({ ...mc, kind: mc.kind } as GateBinding) : null;
}

/**
 * Extract the gate-criteria checklist from a plan body. Locks onto the FIRST heading whose
 * text contains "Phase Gate" or "Gate Criteria" and reads its checklist lines until the next
 * heading — mirroring checkCompletionGate's scan so the two agree on which section is the gate.
 */
export function parseGateCriteria(text: string): GateCriterion[] {
  const out: GateCriterion[] = [];
  let inGate = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      if (inGate) break;
      inGate = line.includes('Phase Gate') || line.includes('Gate Criteria');
      continue;
    }
    if (!inGate) continue;
    const m = CHECKBOX_LINE.exec(line);
    if (!m) continue;
    const checked = m[1] === 'x' || m[1] === 'X';
    const id = m[2] ? m[2].trim() : null;
    let text2 = m[3] ?? '';
    let binding: GateBinding | null = null;
    const vm = VERIFY_SUFFIX.exec(text2);
    if (vm) {
      binding = parseBinding(vm[1]); // may be null ⇒ treated as unbound
      text2 = text2.slice(0, vm.index).trim();
    }
    out.push({ id, text: text2.trim(), checked, binding, rawLine: line });
  }
  return out;
}

/** Does the plan body contain a gate section at all? (a heading with "Phase Gate"/"Gate Criteria") */
export function hasGateSection(text: string): boolean {
  return text.split('\n').some((l) => l.startsWith('#') && (l.includes('Phase Gate') || l.includes('Gate Criteria')));
}

function tierOf(binding: GateBinding | null): GateTier {
  if (!binding) return 3; // unbound / legacy
  if (binding.kind === 'human') return 3;
  if (binding.kind === 'human_check') return 2;
  return 1; // machine-derived
}

/** Resolve one machine check against evidence → {satisfied, reason}. */
function resolveMachineCheck(
  check: MachineCheck,
  id: string | null,
  ev: GateEvidence,
): { satisfied: boolean; reason: string } {
  const fm = ev.frontmatter ?? {};
  switch (check.kind) {
    case 'tests_pass': {
      const ok = String(fm.tests_last_result) === 'pass';
      return { satisfied: ok, reason: ok ? 'tests_last_result: pass' : `tests_last_result: ${fm.tests_last_result ?? 'none'}` };
    }
    case 'steps_done': {
      const ok = ev.hasPendingSteps === false;
      return { satisfied: ok, reason: ok ? 'no pending steps' : 'implementation steps still pending' };
    }
    case 'frontmatter': {
      const actual = fm[check.field as string];
      const ok = String(actual) === check.value;
      return { satisfied: ok, reason: `${check.field}=${String(actual)} ${ok ? '==' : '!='} ${check.value}` };
    }
    case 'file_exists': {
      if (ev.fileExists) {
        const ok = ev.fileExists(check.path as string);
        return { satisfied: ok, reason: `${check.path} ${ok ? 'exists' : 'missing'}` };
      }
      // No predicate injected — fall back to a recorded result keyed by id.
      const rec = id ? ev.gateEvidence?.[id] : undefined;
      if (!rec) return { satisfied: false, reason: `file_exists:${check.path} not recorded (needs an (id) + a recorded verify run)` };
      return { satisfied: rec.satisfied, reason: rec.detail ?? `recorded: ${rec.satisfied}` };
    }
    case 'cmd': {
      if (!id) return { satisfied: false, reason: `cmd:${check.cmd} requires an (id) to key its recorded result` };
      const rec = ev.gateEvidence?.[id];
      if (!rec) return { satisfied: false, reason: `cmd:${check.cmd} not run yet (no recorded result — run the verify step)` };
      return { satisfied: rec.satisfied, reason: rec.detail ?? `cmd:${check.cmd} → ${rec.satisfied ? 'pass' : 'fail'}` };
    }
  }
}

/**
 * Resolve a criterion into {tier, satisfied, reason}. Pure — depends only on the criterion and
 * the supplied evidence. Unbound criteria keep legacy semantics (satisfied ⇔ box checked).
 */
export function resolveCriterion(crit: GateCriterion, ev: GateEvidence = {}): CriterionResult {
  const tier = tierOf(crit.binding);
  const b = crit.binding;

  // Unbound (legacy): trust the typed box.
  if (!b) {
    return { tier: 3, satisfied: crit.checked, reason: crit.checked ? 'checked (legacy, unverified)' : 'unchecked' };
  }

  // Tier 3 — pure human judgement: requires a recorded attestation.
  if (b.kind === 'human') {
    if (!crit.id) return { tier, satisfied: false, reason: 'human criterion requires an (id) to attach its attestation' };
    const att = ev.attestations?.[crit.id];
    return att
      ? { tier, satisfied: true, reason: `attested by ${att.by}${att.role ? ` (${att.role})` : ''}${att.commit ? ` @ ${att.commit}` : ''}` }
      : { tier, satisfied: false, reason: 'awaiting human attestation' };
  }

  // Tier 2 — human attests AND a machine check must not be false (cross-check).
  if (b.kind === 'human_check') {
    const mc = resolveMachineCheck(b.check, crit.id, ev);
    if (!crit.id) return { tier, satisfied: false, reason: 'human+check criterion requires an (id) to attach its attestation' };
    const att = ev.attestations?.[crit.id];
    if (!att) return { tier, satisfied: false, reason: `awaiting human attestation (${mc.reason})` };
    if (!mc.satisfied) return { tier, satisfied: false, reason: `attestation contradicted by evidence: ${mc.reason}` };
    return { tier, satisfied: true, reason: `attested by ${att.by} + ${mc.reason}` };
  }

  // Tier 1 — machine-derived.
  const mc = resolveMachineCheck(b, crit.id, ev);
  return { tier, satisfied: mc.satisfied, reason: mc.reason };
}

/** The machine check underlying a binding: the binding itself (tier 1) or the sub-check of a
 *  tier-2 human+check. null for `human` (tier 3) and unbound criteria — nothing to run. */
export function machineCheckOf(binding: GateBinding | null): MachineCheck | null {
  if (!binding) return null;
  if (binding.kind === 'human') return null;
  if (binding.kind === 'human_check') return binding.check;
  return binding as MachineCheck; // tier 1
}

/**
 * Evaluate a machine check LIVE — actually running fs/cmd via injected effects — into a fresh
 * evidence entry. The step-3 recorder wires real fs/exec; tests inject fakes. Pure otherwise.
 */
export function evaluateMachineCheckLive(check: MachineCheck, fx: LiveEffects): { satisfied: boolean; detail: string } {
  const fm = fx.frontmatter ?? {};
  switch (check.kind) {
    case 'tests_pass': {
      const ok = String(fm.tests_last_result) === 'pass';
      return { satisfied: ok, detail: `tests_last_result: ${fm.tests_last_result ?? 'none'}` };
    }
    case 'steps_done':
      return { satisfied: fx.hasPendingSteps === false, detail: fx.hasPendingSteps === false ? 'no pending steps' : 'implementation steps still pending' };
    case 'frontmatter': {
      const actual = fm[check.field as string];
      return { satisfied: String(actual) === check.value, detail: `${check.field}=${String(actual)} (want ${check.value})` };
    }
    case 'file_exists': {
      const ok = fx.fileExists ? fx.fileExists(check.path as string) : false;
      return { satisfied: ok, detail: `${check.path} ${ok ? 'exists' : 'missing'}` };
    }
    case 'cmd': {
      const r = fx.runCmd ? fx.runCmd(check.cmd as string) : null;
      return r ?? { satisfied: false, detail: `cmd:${check.cmd} not allowed (not in the verify allowlist)` };
    }
  }
}

/**
 * Named checks a `cmd:` criterion may reference → the package.json script each runs. This is the
 * security boundary for `cmd:` verification: only these names execute; anything else records
 * satisfied:false without running. Shared by every surface that records evidence.
 */
export const GATE_CMD_ALLOWLIST: Readonly<Record<string, string>> = Object.freeze({
  typecheck: 'typecheck',
  lint: 'lint',
  'roadmap-check': 'roadmap:check',
  'test-dispatch': 'test:dispatch',
});

export interface BuiltEvidence {
  evidence: Record<string, EvidenceEntry>;
  recorded: Array<{ id: string; satisfied: boolean; detail: string; raw: string }>;
  warnings: string[];
}

/**
 * Evaluate every MACHINE-bound criterion in a plan LIVE (via injected effects) and build the
 * gate_evidence map, merged onto any existing evidence. Pure — the recorder surfaces (MCP tool,
 * Web UI endpoint) inject real fs/exec and then persist the returned `evidence`. human/unbound
 * criteria are skipped; machine criteria without an (id) are reported in `warnings`.
 */
export function buildGateEvidence(
  text: string,
  fx: LiveEffects,
  stamp: { commit?: string; ts?: string } = {},
  existing: Record<string, any> = {},
): BuiltEvidence {
  const evidence: Record<string, EvidenceEntry> = { ...existing };
  const recorded: BuiltEvidence['recorded'] = [];
  const warnings: string[] = [];
  for (const c of parseGateCriteria(text)) {
    const mc = machineCheckOf(c.binding);
    if (!mc) continue;
    if (!c.id) {
      warnings.push(`"${c.text}" (verify: ${mc.raw}) has no (id) — cannot key evidence; add an (id).`);
      continue;
    }
    const r = evaluateMachineCheckLive(mc, fx);
    evidence[c.id] = { satisfied: r.satisfied, detail: r.detail, at: stamp.commit, ts: stamp.ts };
    recorded.push({ id: c.id, satisfied: r.satisfied, detail: r.detail, raw: mc.raw });
  }
  return { evidence, recorded, warnings };
}

export interface GateAudit {
  satisfied: boolean;
  criteria: Array<GateCriterion & { result: CriterionResult }>;
  unmet: Array<GateCriterion & { result: CriterionResult }>;
}

/** Resolve every criterion in a plan body against evidence and report overall satisfaction. */
export function auditGateCriteria(text: string, ev: GateEvidence = {}): GateAudit {
  const criteria = parseGateCriteria(text).map((c) => ({ ...c, result: resolveCriterion(c, ev) }));
  const unmet = criteria.filter((c) => !c.result.satisfied);
  return { satisfied: unmet.length === 0, criteria, unmet };
}
