# Authz redesign — implementation plan (DRAFT, pre-approval)

**Status: DRAFT.** Becomes the real `plans/` plan once
[[proposals/retire-human-approved-global-gate-for-purpose-based-authorization]] is approved
and the hardened model ([[docs/authz-model-hardening-review]]) is confirmed by BDFL + BigPickle.
No enforcement code is written until then — this is the buildable spec, decomposed small +
verifiable, constraints inline (Haiku-executable).

**Guiding rule (from the review): the gate is never *absent*, only ever *doubled*.** Build the
new primitive additive + warn-only, run it in parallel with the legacy `HUMAN_APPROVED` as a
double-gate through a burn-in, and remove legacy LAST.

## The primitive being built

A **grant** = a server-minted, single-use, scope-bound authorization record the AI cannot mint.
- Minted only by a genuine authenticated human action (UI click / `docwright grant` CLI).
- Recorded server-side in `.docwright/grants.jsonl` (a path the AI process cannot write).
- Fields: `{ nonce, action_class, target, content_hash?, operator_id, issued_at, expiry, consumed_at|null }`.
- Verified by the gated layer (must exist, unexpired, unconsumed, action_class+target match),
  then marked consumed. Relayed as a commit trailer `DW-GRANT:<nonce>` or a tool arg.
- Conversational authorization is the *trigger* that causes a mint; the token is the *seal*.

## Action classes (the taxonomy — axis = reversibility × verifiability)

| Class | Members | Auth | Enforcing layer |
|---|---|---|---|
| Informational | reads, dry-runs, searches | none | — |
| Reversible mutation | code edits, branch commits, plan-step updates | none; audit-logged | L1 (plan writes via MCP) + L4 shape guards + hardened audit |
| Irreversible / outward | merge-to-trunk, delete (issue/branch/ref), release/tag, external send (`contribute_upstream`, webhook, email) | grant token, target-scoped | NEW PreToolUse Bash-matcher (deny w/o token) |
| Governance-doc lifecycle | `approved`, `completed`, `gate_status` | grant token minted by an authenticated **UI action** (required second factor) | commit-msg hook + L4 MCP (consume token) |

## Implementation steps

### Phase A — additive primitive, warn-only (legacy stays fully load-bearing)

| # | Step | Done-when (verifiable) |
|---|---|---|
| A1 | **Audit hardening first (blocking prerequisite).** In `src/mcp/lib/audit.ts` + the UI audit path: require an explicit `operator_id` (remove the `'NetYeti'`/`$USER` fallback → if absent, the caller must pass it); **fail-closed** (a write error throws, not `catch {}`); make the log append-only + hash-chained (`prev_hash = sha256(prev_line)`); write via a path the AI process can't append to (server-owned). | Unit tests: a missing actor fails; a write error fails the action; a tampered line breaks the chain. |
| A2 | **Grant store + token model.** New `src/dispatch/grants.ts`: `mintGrant(store, {action_class, target, content_hash?, operator_id, ttlMs})→nonce`; `verifyGrant(store, nonce, action_class, target, now)→{ok, reason}`; `consumeGrant(store, nonce)`. Pure over an injectable store (file-backed `.docwright/grants.jsonl` in prod). No VS Code deps. | Unit tests: mint→verify ok; expired denied; consumed denied (single-use); action/target mismatch denied; unknown nonce denied. |
| A3 | **UI minting + real per-action confirmation.** `approve-proposal` / `transition-completed` / gate endpoints: on the authenticated human action, require a fresh interactive confirmation **bound to `{filePath, sha256(content)}`** (modal + re-auth or passkey), verify the principal is a human-operator (Forgejo team, not the AI identity), then `mintGrant(...)` and stamp `DW-GRANT:<nonce>` into the commit trailer. **Decide `AUTH_MODE=none`:** either forbid governance transitions in that mode or require real auth for them (no more synthesized-admin auto-seal). *Warn-only:* keep stamping legacy `HUMAN_APPROVED` too for now. | Endpoint test: an approval with no fresh confirmation is refused; a valid one mints a grant + stamps the trailer; `AUTH_MODE=none` governance transition follows the chosen policy. |
| A4 | **CLI grant command** (the CLI-human path — the surface with no UI button). `docwright grant <verb> <target>` → mints a grant record + prints the `DW-GRANT:<nonce>` trailer for the human to include. This is what replaces a shell human typing `HUMAN_APPROVED=1`. | `npm run` / CLI test: issues a valid, verifiable, single-use grant. |
| A5 | **PreToolUse Bash-matcher (warn mode).** Extend the hook (today it only matches `Write`/`Edit`) to pattern-match `git push`, `gh pr merge`, `gh issue delete`, `git tag/push --tags`, and known external-send commands; **log** whether a matching unconsumed grant exists — do NOT deny yet. | Hook test: the matcher fires + logs for each pattern; exit 0 (warn). |
| A6 | **commit-msg token check (warn mode).** `commit-msg.sh`: if the commit is a governance transition, verify a `DW-GRANT` nonce exists+unconsumed in the store — log mismatches, don't block (legacy marker still blocks). | Hook test: valid nonce logs ok; missing nonce warns, still passes on legacy marker. |

*(Defer the CI grep-gate for `HUMAN_APPROVED` — it would fail this whole phase.)*

### Phase B — parallel enforce (token enforcing + legacy still required = doubled)

| # | Step | Done-when |
|---|---|---|
| B1 | Flip A6 to **deny**: governance commits need BOTH a valid `DW-GRANT` nonce AND the legacy marker. | Negative test: governance commit with marker but no valid nonce is denied. |
| B2 | Flip A5 to **deny**: irreversible/outward Bash actions require a matching unconsumed target-scoped grant. | Negative tests: merge/delete/release/send without a grant → denied; conversational-only → denied; injected/file-borne grant → denied + logged as probable injection; replay → denied; `pr:240` token can't merge `pr:241`. |
| B3 | **L4 MCP tools consume the token** (or stay strictly downstream of a token-checked write) so the MCP path isn't a bypass. Keep the existing field-level default-deny guards verbatim. | Test: `transition_to_*` without a consumed token is refused. |
| B4 | **Burn-in** across BOTH surfaces (Web UI + CLI/Claude Code) and BOTH `AUTH_MODE` settings; watch `grants.jsonl` + the hardened audit for correct mint/consume. | A documented burn-in window with green negatives on every surface. |

### Phase C — retire legacy (only after B4 is clean)

| # | Step | Done-when |
|---|---|---|
| C1 | Remove `HUMAN_APPROVED` env check from `scripts/claude-lifecycle-hook.sh`; remove marker logic from `scripts/pre-commit.sh` (`validate_no_self_approval`) + `scripts/commit-msg.sh`; unstaple `HUMAN_APPROVED:'1'` from `src/webui/src/lib/server/git-commit.ts`. **Both artifacts retire together.** | Grep shows no runtime `HUMAN_APPROVED`/`HUMAN-APPROVED` enforcement remains. |
| C2 | **Coordinate with `plans/adopt-milestone-driven-roadmap-discipline.md` step 19** (consumes both commit forms) — update it to the token before removing the artifacts, or it breaks. | That plan's step 19 verified against the new trailer. |
| C3 | Purge `HUMAN_APPROVED` from docs (CLAUDE.md, AGENTS.md, `docs/ai-governance-enforcement.md`, `docs/collaboration.md`, `docs/SOPs/lifecycle-compliance.md`, `WORKFLOW-BLOCKERS.md`, `.claude/skills/critique-plan/SKILL.md`); note the approved-proposal/plan references as historical. | Docs describe only the grant model. |
| C4 | Rewrite `policies/core/ai-governance-boundaries.md` + `workflow-layer-governance.md` around the action-class model; cross-link `mutual-augmentation-cycle` as rationale. | Policies match the shipped mechanism. |
| C5 | **Add the CI grep-gate LAST** — fail CI on any `HUMAN_APPROVED`/`HUMAN-APPROVED` reference in enforcement/docs. | CI green with the gate on. |

## Testing plan (the negatives are the point)

- A2/A1 unit suites (grant lifecycle; audit fail-closed + hash-chain).
- Conversational-only grant **denied** for merge/delete/release/send (B2).
- Injected/file-borne grant **denied** at each surface + logged as probable injection (B2).
- Single-use (replay denied) + target-bound (`pr:240`≠`pr:241`) (B2).
- Governance transition needs a UI-minted token; AI cannot self-advance (B1/B3).
- `AUTH_MODE=none` governance policy enforced (A3).
- Final grep-gate (C5).

## Rollback

- Phases A–B are additive; disable by feature flag → legacy `HUMAN_APPROVED` still governs.
- After C: revert the C commits (legacy is git-history-recoverable); the grant store persists.

## Phase gate (draft)

- [ ] Audit hardened (attributed, fail-closed, hash-chained) — prerequisite, shipped first
- [ ] Grant primitive built + unit-tested (mint/verify/consume; expiry; single-use; scope)
- [ ] All four enforcing surfaces mint/verify tokens (UI, CLI, Bash-matcher, commit-msg/L4)
- [ ] Burn-in clean on both surfaces + both AUTH_MODEs; every negative test green
- [ ] `AUTH_MODE=none` governance policy decided + enforced
- [ ] adopt-milestone step 19 coordinated; both legacy artifacts retired together
- [ ] Docs + policies rewritten; CI grep-gate on (last)
- [ ] The pre-existing `git-commit.ts` security hole is closed by A3 (verify)

## Open design questions for review

1. **Per-action confirmation strength** (A3): re-auth vs passkey/WebAuthn vs a bound modal — how heavy?
2. **Grant store location + perms**: `.docwright/grants.jsonl` must be AI-unwritable — enforced by fs perms, a separate uid, or an MCP-owned path? (Depends on deployment; the image runs as one process.)
3. **`AUTH_MODE=none`**: forbid governance transitions outright, or allow with a printed CLI grant? (Single-user local vaults still need to self-approve.)
4. **External-send enumeration** (B2): the definitive list of "outward" commands to match — needs to be exhaustive or it's a hole.
