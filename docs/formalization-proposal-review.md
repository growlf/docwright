# Progressive-formalization proposal — adversarial review synthesis

Companion to [[proposals/progressive-skill-script-formalization]]. Three independent reviewers
(efficacy/premature-abstraction · mechanism/implementability · fit + generated-tooling trust),
run 2026-07-13. For BDFL review.

## Verdict

**Approve the *intent* (formalize genuinely-repeated work); split the proposal; do not ship it
as written.** Its spine — a manual→skill→script cadence — is a real, useful sharpening of
`one-off-formalization`. But it bundles a **safe, small cadence rule** with a **large, ungoverned,
risky engine** (an AI that authors tools it then runs), and several load-bearing mechanisms are
non-buildable as specified. All three reviewers independently converged on: **split it.**

## The split (all three reviewers)

- **Part A — cadence rule (safe, approvable now).** The "~3× → skill, repeated-use → script"
  ladder + session-start detection. A lightweight amendment to `one-off-formalization`. Ship
  fast, with the fixes below.
- **Part B — skill-writer / self-authored tooling (gated, DEFERRED).** The AI authoring
  skills/scripts/MCP tools it then runs. This is a **trust/supply-chain surface** and must not
  advance until it binds to the **same generated-tooling review gate the authz redesign is
  building** ([[docs/authz-model-hardening-review]]). Spins out as its own proposal then.

## Converged findings + fixes

### Part B is the risk (CRITICAL — fit/trust reviewer)
An AI-authored MCP tool is code the AI can invoke in its own process against git/lifecycle/external
state with no human having read it — **strictly worse than a forged grant** (a token authorizes one
known action; a generated tool is arbitrary new authorized capability). `code-over-memory` trusts
MCP tools *because a human wrote and reviewed them*; self-authored tooling inverts that. The authz
work hardens the front door (who may trigger a mutation); this would quietly install a side door
(the AI manufactures new mutation primitives). **Non-negotiables for Part B:** a human reviews the
generated artifact itself (reads the code, not a blind "yes, upgrade"); generated code goes through
the identical pipeline (pre-commit, typecheck/test, lint, CI, human-merged PR); **no auto-activation
of any state-mutating generated tool**; state-mutating generated tools bind to the authz
irreversible/outward tier (signed grant); the self-upgrade "offer" may only *draft a PR/proposal*,
never register or run a tool; forbidden under `AUTH_MODE=none`.

### "Self-instrumenting markdown skill tracks its own usage" is mechanically impossible (SEVERE — mechanism reviewer)
A skill is a static `.md` file loaded into context; markdown doesn't execute, and the LLM has no
reliable cross-session memory to self-count. The counter is always "1" (never persists) or fires
every turn (nags). **Fix:** move the counter OUT of the skill into an **append-only, gitignored
`.docwright/skill-usage.jsonl`** (reusing the existing `audit.jsonl`/`write-audit.jsonl` substrate);
each skill's instrumentation reduces to one deterministic "append a `skill_invoked` record" call; a
tiny aggregator emits candidates at session-start. This also fixes the multi-session/multi-agent
counter home (a git-tracked counter would merge-conflict on every reconcile) and the
`AUTH_MODE=none`/concurrency issues in one move.

### Detection "by scanning the last session log" targets the wrong data + is fuzzy (SEVERE — mechanism reviewer)
`session_context` loads the **SESSION-LOG.md one-line index**, not the detailed session-note prose,
so the repeated-flow signal (a human wrote "~10×" into a note) isn't even present; and "same task
shape" is a semantic-similarity problem, not string-matching ("no heavy infra" ⟂ "reliable
detection"). **Fix:** detect from the structured `skill-usage.jsonl` (exact `GROUP BY`), not prose;
keep detection **advisory + human-confirmed** (mirror the trusted `capture_bug_report` suggest→confirm
flow); read a rolling window, not just the last session.

### Count ≠ stability → premature abstraction of moving targets (HIGH — efficacy reviewer)
A ~2-3× count is a low bar and ignores whether the task's *shape is stable*. The exhibit flows all
wrap **lifecycle/gate machinery still under active development** — formalizing them freezes a moving
target that then silently misleads. **Fix:** two-gate trigger — done ≥3× **and** shape unchanged
between the last runs **and** the substrate isn't an in-progress plan. Add an explicit **"when NOT
to formalize"** clause.

### No retirement path → guaranteed sprawl (HIGH — efficacy reviewer)
Every arrow points up; nothing prunes a skill used once. 14 skills today → 20-25 quickly, paying a
discovery tax every session. The self-upgrade "offer" adds upward pressure with no downward. **Fix:**
code retirement into session-start (record `last_used`; surface "unused in N sessions — retire?");
a ladder needs a chute, not just a ratchet.

### "Drops measurably" has no metric (HIGH — efficacy reviewer)
No usage/token baseline infra exists; the central efficacy claim is unfalsifiable and counts only
the benefit, never authoring+maintenance+discovery cost. **Fix:** capture a baseline for ONE pilot
flow before building; require the scripted version to beat it net of amortized authoring/maintenance.

### MCP-tool promotion on ~3 uses is disproportionate (MED-HIGH — efficacy reviewer)
An MCP tool is a governance surface; gating it on a trivial count applies a heavyweight, hard-to-
remove artifact to weak evidence. **Fix:** decouple *form* from *count* — count *suggests
considering*; the *form* is a judgment call from `one-off-formalization`'s menu; MCP tools (mutations)
need explicit human sign-off + review regardless of count. Most flows stop at skill or npm script.

### Skill-writer-first is backwards (MED — efficacy reviewer)
Building the factory before validating the product; the template mass-produces whatever defect it
encodes. **Fix:** hand-write ONE skill for the most-settled flow (branch-per-fix), measure, and only
then extract a skill-writer — as deliverable #N justified by evidence, not #1 on faith.

## Bottom line

Part A (cadence + detection), rebuilt on a `.docwright/skill-usage.jsonl` event log with a
stability-gated trigger, a retirement path, human-confirmed suggestions, and a measured pilot, is a
genuine improvement worth shipping soon. Part B (the skill-writer / self-authored-tooling engine)
is the risk and is **held** until it binds to the authz generated-tooling trust gate — same trust
boundary, one layer up.
