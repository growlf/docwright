# Authz redesign — implementation plan (DRAFT, pre-approval)

**Status: DRAFT.** Becomes the real `plans/` plan once
[[proposals/retire-human-approved-global-gate-for-purpose-based-authorization]] is approved
and the hardened model ([[docs/authz-model-hardening-review]]) is confirmed by BDFL + BigPickle.
No enforcement code is written until then — this is the buildable spec, decomposed small +
verifiable, constraints inline (Haiku-executable).

> **SECOND-PASS REVISION (2026-07-13).** A fresh adversarial pass on THIS plan
> ([[docs/authz-model-hardening-review]] §"Second-pass") proved a token-in-a-file is
> self-issuable/self-forgeable in DocWright's single-process, single-uid, AI-drives-everything
> deployment. Corrections folded in below: **(1)** a grant must be a **secret-keyed signature the
> AI process does not hold** (ideally **Forgejo-issued** via OAuth re-auth), verified by
> *signature*, never file-presence — a signer/key-custody step (A0) precedes everything;
> **(2)** `AUTH_MODE=none` handling + store integrity are **blocking prerequisites**, not open
> questions (gated classes forbidden or real-auth-only in that mode); **(3)** the Bash-matcher is
> **defense-in-depth**, not the boundary — **Forgejo branch/tag protection + a capability-scoped
> bot token** is the real gate for push/merge/tag, and **delete/external-send are gated
> server-side inside the MCP tool**; **(4) B3 reorders FIRST** among the enforcing flips.

**Guiding rule (from the review): the gate is never *absent*, only ever *doubled*.** Build the
new primitive additive + warn-only, run it in parallel with the legacy `HUMAN_APPROVED` as a
double-gate through a burn-in, and remove legacy LAST.

## The primitive being built

A **grant** = a **signed**, single-use, scope-bound authorization the AI process cannot forge
(because it lacks the signing key), issued by an **out-of-process** custodian.
- **Signed by a key the AI process does not hold** — Forgejo (OAuth re-auth), a WebAuthn/passkey
  assertion, or a separate-uid signer daemon. NOT a local `docwright grant` command that mints on
  its own (the AI could run it) and NOT mere presence in a file (the AI can write the file).
- Payload (signed): `{ nonce, action_class, target, content_hash, operator_id, issued_at, expiry }`.
  `operator_id` comes from the signed payload — never an AI-supplied argument.
- `.docwright/grants.jsonl` is at most a **cache**; verification checks the **signature**, so a
  hand-forged line fails. (In a single-uid image the file is AI-writable — do not treat it as a
  boundary.)
- Verified by the gated layer: signature valid, unexpired, unconsumed, `action_class`+`target`
  match, and (governance) `content_hash` re-verified against the **staged** bytes at consume;
  then **atomically** consumed. Relayed as a `DW-GRANT:<signed-blob>` trailer or a tool arg.
- Conversational authorization is the *trigger* that causes a human to sign; the signature is the
  *seal*. There is **no AI-reachable mint path** for gated classes.

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
| **A0** | **Signer / key custody (blocking — build nothing token-shaped before this).** Decide + stand up the out-of-process grant signer. Prefer **Forgejo**: an OAuth re-auth issues a grant signed by Forgejo's secret (reuses invariant #5 identity). Fallbacks: WebAuthn/passkey verified out-of-process, or a separate-uid signer daemon. Define the signed payload + `verifyGrant` = **signature check** (not file presence). Decide `AUTH_MODE=none`: gated classes **forbidden** (or real-auth-only) — no synthetic-admin minting. | A signed grant verifies; a hand-forged `grants.jsonl` line **fails** signature check; there is **no AI-runnable command/endpoint that mints for gated classes**; `AUTH_MODE=none` gated transitions are refused. |
| **A0b** | **Forgejo/GitHub branch+tag protection + capability-scoped bot token (blocking, the real boundary for push/merge/tag).** The AI's token cannot push to `main`, push tags, or delete protected refs; those fail **at the server** regardless of the command string. | Server rejects a bot-token push to `main`/tag/protected-ref delete; verified against the live git server. |
| A1 | **Audit hardening (blocking prerequisite).** In `src/mcp/lib/audit.ts` + the UI audit path: **fail-closed** (a write error throws, not `catch {}`); append-only + hash-chained (`prev_hash`). Take `operator_id` from the **verified signed grant payload** (A0), never an AI-supplied argument or the `'NetYeti'`/`$USER` fallback. Note honestly: in a single-uid image the chain is **tamper-*detection*, not prevention** (the writer can recompute it) unless HMAC-keyed by A0's key or written to an out-of-process sink. | Unit tests: write error fails the action; a tampered chain is detected; actor is copied from the grant, not a param. |
| A2 | **Grant store + token model.** New `src/dispatch/grants.ts`: `mintGrant(store, {action_class, target, content_hash?, operator_id, ttlMs})→nonce`; `verifyGrant(store, nonce, action_class, target, now)→{ok, reason}`; `consumeGrant(store, nonce)`. Pure over an injectable store (file-backed `.docwright/grants.jsonl` in prod). No VS Code deps. | Unit tests: mint→verify ok; expired denied; consumed denied (single-use); action/target mismatch denied; unknown nonce denied. |
| A3 | **UI minting + real per-action confirmation.** `approve-proposal` / `transition-completed` / gate endpoints: on the authenticated human action, require a fresh interactive confirmation **bound to `{filePath, sha256(content)}`** (modal + re-auth or passkey), verify the principal is a human-operator (Forgejo team, not the AI identity), then `mintGrant(...)` and stamp `DW-GRANT:<nonce>` into the commit trailer. **Decide `AUTH_MODE=none`:** either forbid governance transitions in that mode or require real auth for them (no more synthesized-admin auto-seal). *Warn-only:* keep stamping legacy `HUMAN_APPROVED` too for now. | Endpoint test: an approval with no fresh confirmation is refused; a valid one mints a grant + stamps the trailer; `AUTH_MODE=none` governance transition follows the chosen policy. |
| A4 | **CLI grant command** (the CLI-human path — the surface with no UI button). `docwright grant <verb> <target>` → mints a grant record + prints the `DW-GRANT:<nonce>` trailer for the human to include. This is what replaces a shell human typing `HUMAN_APPROVED=1`. | `npm run` / CLI test: issues a valid, verifiable, single-use grant. |
| A5 | **PreToolUse Bash-matcher (warn mode).** Extend the hook (today it only matches `Write`/`Edit`) to pattern-match `git push`, `gh pr merge`, `gh issue delete`, `git tag/push --tags`, and known external-send commands; **log** whether a matching unconsumed grant exists — do NOT deny yet. | Hook test: the matcher fires + logs for each pattern; exit 0 (warn). |
| A6 | **commit-msg token check (warn mode).** `commit-msg.sh`: if the commit is a governance transition, verify a `DW-GRANT` nonce exists+unconsumed in the store — log mismatches, don't block (legacy marker still blocks). | Hook test: valid nonce logs ok; missing nonce warns, still passes on legacy marker. |

*(Defer the CI grep-gate for `HUMAN_APPROVED` — it would fail this whole phase.)*

### Phase B — parallel enforce (token enforcing + legacy still required = doubled)

**Order: B3 lands FIRST.** The AI drives the MCP server directly, and `transition_to_*` trusts the
frontmatter flag today — so until the MCP path consumes a signed grant, the "doubled" gate is
*single* on the surface the AI most easily drives. Gate MCP before the commit/Bash surfaces.

| # | Step | Done-when |
|---|---|---|
| B3 (first) | **L4 MCP tools require a verified signed grant** (or stay strictly downstream of a grant-checked write) so the MCP path isn't a bypass during the whole window. Keep the existing field-level default-deny guards verbatim. **Delete + external-send are gated HERE, server-side in the MCP tool** — they have no downstream backstop, so a client-side Bash grep is not an acceptable sole control. | `transition_to_*` / delete / `contribute_upstream` without a verified grant are refused. |
| B1 | Flip A6 to **deny**: governance commits need BOTH a valid signed `DW-GRANT` AND the legacy marker. | Negative test: governance commit with marker but no valid signed grant is denied. |
| B2 | Flip A5 to **deny** — but this is **defense-in-depth, not the boundary** (the real boundary is A0b: Forgejo protection + scoped token). Bash-matcher default-denies irreversible/outward without a matching grant. | Negative tests: merge/delete/release/send without a grant → denied; conversational-only → denied; injected/file-borne grant → denied + logged as probable injection; replay → denied; `pr:240` grant can't merge `pr:241`. **Also documented: the matcher is bypassable (`gh api`, subprocess, wrappers) — A0b is what actually stops those.** |
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
- [ ] The pre-existing `git-commit.ts` unconditional-stamp hole is closed at **C1** (it persists
      through A/B while legacy stays load-bearing — do not mark it closed earlier)

## Open design questions for review

*Resolved by the second pass (now blocking prerequisites, not questions):* grant-store integrity
(→ signature check, not fs perms), `AUTH_MODE=none` minting (→ forbidden/real-auth-only),
external-send enumeration (→ moot as a boundary; gated server-side in the MCP tool, A0b/B3).

Genuinely still open:

1. **Which signer (A0)?** Forgejo OAuth re-auth (recommended — reuses invariant #5, already
   deployed for the reference impl) vs WebAuthn/passkey vs a separate-uid daemon. Trade-off:
   Forgejo requires the vault be Forgejo-backed; passkey requires enrolled hardware.
2. **The solo-local case (the hard one).** A single-operator local vault with `AUTH_MODE=none`
   has no Forgejo and no separate principal — the operator legitimately *is* the only human, but
   also shares the uid with the AI, so there's no out-of-process key. Options: an interactive
   passphrase-derived signing key entered per gated action (a real human keystroke the AI can't
   replay if never persisted); or accept that solo-local is an explicitly lower-assurance,
   single-trusted-operator mode with the gated classes **disabled** (governance done only on a
   Forgejo-backed deployment). **Needs a BDFL call** — it's the one place "no AI-mintable path"
   genuinely conflicts with "solo user must self-approve."
3. **Canonical `target` normalization** shared by minter + every verifier (so `pr:240` /
   `.../pulls/240/merge` / branch / SHA don't create scope-match gaps that pressure widening).
