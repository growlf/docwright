# Authorization-model hardening review — adversarial synthesis

Companion to [[proposals/retire-human-approved-global-gate-for-purpose-based-authorization]].
A three-perspective adversarial review (injection red-team · mechanical enforceability ·
guarantee-regression audit) plus synthesis, run 2026-07-13. Purpose: find REAL flaws in the
proposed model and resolve them so DocWright still gets what it needs. For BDFL + BigPickle
review alongside the proposal.

> **Load-bearing security claims verified directly against the code (2026-07-13), not just
> relayed from the reviewers:** `git-commit.ts:27` (`HUMAN_APPROVED: '1'` hardcoded),
> `hooks.server.ts:17,21` (`AUTH_MODE ?? 'none'` → `DEV_USER` with `teams:['admin']`),
> `audit.ts:15,30` (`'NetYeti'` actor fallback + `catch {}` swallow). All three confirmed.

## Verdict

**Approve the direction; do not ship the model as written.** Retiring the blunt global
`HUMAN_APPROVED` gate and governing by policy + audit is right *for reversible work* — and
is actually a net *increase* in governance there (see Correction 1). But as written the
proposal (a) over-credits today's gate, (b) draws its strong bar around "governance
documents" when the safety-relevant axis is **reversibility**, and (c) rests provenance +
scope + audit on AI self-restraint, which `code-over-memory` explicitly rejects. All three
are fixable without abandoning the idea. One primitive fixes most of it: a **server-minted,
single-use, scope-bound grant token**.

## Where the three reviews converged (highest confidence)

1. **The status quo is weaker than the proposal claims.** `src/webui/src/lib/server/git-commit.ts`
   stamps `HUMAN_APPROVED:'1'` into the env of *every* UI commit unconditionally; the approve
   endpoints are gated only by `requireAuth` (a session cookie); and `AUTH_MODE=none` (the
   default) synthesizes a `DEV_USER` with `teams:['admin']` — i.e. no human at all on the
   default local deployment. So today's "un-fakeable human keystroke" does not exist on the
   primary surface. The proposal must stop crediting the env var as a keystroke-proof act.

2. **The strong bar belongs on reversibility, not document-type.** Audit + revocation is a
   real safety net only for reversible surfaces (git-versioned files). It is **not** a net
   for: merge-to-trunk (consumable by CI/agents/releases before revert), delete (often
   unrecoverable), release/tag (Watchtower/image deploys act on it — effectively
   irreversible), external send (`contribute_upstream`, webhooks, email — the bytes left).
   The proposal keeps a non-conversational factor for the *lowest*-blast-radius irreversible
   action (a frontmatter flag) and assigns the *highest* ones only a conversational grant.
   Backwards. **The non-conversational second factor must cover every irreversible/outward
   action, not just governance docs.**

3. **Provenance is unenforceable as prose; make it a token.** No layer in the repo can tell
   an operator-typed grant from one lifted out of a file/issue body/tool output/recalled
   memory — a hook sees a string. "Grants only from the authenticated human" is a behavioral
   instruction, not a control. Converting it to a **server-minted nonce** (below) makes it a
   checkable property and simultaneously kills scope-stretch (token is target-bound) and
   replay (single-use + TTL).

## Corrections the proposal needs (factual)

- **There is no "runtime classifier" in the repo.** Action-authorization for merge/delete/
  release is not gated by DocWright code at all today — it's OpenCode-runtime behavior
  outside this repo. So the proposal's "everything else already works conversationally under
  audit" is wrong: those classes are currently **ungoverned**. Honest delta: the model is
  *stronger* than claimed on reversible classes (it formalizes governance that's absent
  today) and *weaker* on irreversible ones. Say so — it strengthens the case where the case
  is real.
- **The audit backbone is materially weak.** `src/mcp/lib/audit.ts` derives the actor from
  `$OPCODE_USER_NAME/$USER` with a hardcoded `'NetYeti'` fallback, swallows every write
  error (`catch {}`), and writes an in-tree `.docwright/audit.jsonl`; the UI approve audit
  records no actor at all. An audit sink that can't attribute, fails silently, and sits next
  to what it audits is not a safety backbone. Hardening it is a **blocking prerequisite**,
  not a follow-on.

## Enforcement ground truth (four layers, two artifacts)

| Layer | File | Verifies | Blind spot |
|---|---|---|---|
| L1 PreToolUse hook | `scripts/claude-lifecycle-hook.sh` | `HUMAN_APPROVED` env present; blocks `Write/Edit` to `plans/*.md` + `approved:true` flips | Only matches Write/Edit — **never sees Bash `git push`/`gh merge`/`gh issue delete`** |
| L2 pre-commit | `scripts/pre-commit.sh` (`validate_no_self_approval`) | arms `.git/dw-needs-human-approval` on an approval | defers assertion; `--no-verify` bypass |
| L3 commit-msg | `scripts/commit-msg.sh` | `HUMAN-APPROVED:<name>` marker present in msg | AI authors the msg; only the *diff* is stripped |
| L4 MCP transitions | `src/mcp/tools/{transitions,mutation}.ts` | frontmatter state already set; refuses `gate_status` writes | trusts a field some other layer gated |

Two artifacts must retire together: the **env var** `HUMAN_APPROVED` (L1) and the **commit
marker** `HUMAN-APPROVED:<name>` (L2/L3). Irreversible/outward actions have **no layer at all**.

## The hardened model

**Axis = reversibility × who-can-verify.** Three tiers:

| Tier | Actions | Authorization | Enforced by |
|---|---|---|---|
| **Reversible** | reads, dry-runs, code edits, branch commits, plan-step updates | none / conversational; logged | L1 (plan writes via MCP) + L4 shape checks + hardened audit. Keep field-level MCP guards **verbatim**. |
| **Irreversible / outward** | merge-to-trunk, delete, release/tag, external send | **server-minted, single-use, target-scoped grant token** | NEW PreToolUse Bash-matcher default-denies these unless a matching unconsumed token exists |
| **Governance-doc lifecycle** | `approved`, `completed`, `gate_status` | same token, issued by an authenticated **UI action** (the real second factor) | commit-msg/L4 verify the token is present + unconsumed, then consume it |

### The grant-token primitive (the missing piece)

- A human authorizing an action (clicking the UI button, or a CLI grant command) causes the
  **server** to mint a random nonce and record it in a server-side store (e.g.
  `.docwright/grants.jsonl`, AI-unwritable) bound to `{action_class, target, content_hash,
  operator_id, nonce, expiry}`, and emit it as a commit trailer `DW-GRANT:<nonce>` or a token
  the gated tool consumes.
- The gated layer (commit-msg hook / PreToolUse Bash-matcher / MCP tool) verifies the token
  **exists, is unexpired, unconsumed, and matches this exact action+target**, then marks it
  consumed. Single-use.
- The AI can *relay* a token but **cannot mint one** — it never sees a nonce for a click it
  didn't perform. Conversational authorization becomes the *trigger* that causes a mint; the
  token is the enforceable seal. This is the answer to the proposal's open question:
  **provenance = an un-mintable token, not a quoted sentence.**
- Replace the hardcoded `HUMAN_APPROVED:'1'` in `git-commit.ts` with the per-action token.
- Stop-gaps this closes at once: injection-forged grants (no live record), scope-stretch
  (target-bound), replay (single-use + TTL), social-engineering (no token = deny + log as a
  probable injection attempt).

### Audit hardening (blocking prerequisite)

Attributed actor (no `'NetYeti'` fallback, no empty UI actor), **fail-closed** on write error
(a failed audit write fails the action), append-only + hash-chained (`prev_hash`), written by
a path the AI process can't directly append to. Only then is "audit-proof" a proof.

### Keep

- Field-level MCP default-deny guards (`set_plan_field`/`write_plan` refusing `gate_status`;
  `transition_to_approved` requiring `approved` already set) — orthogonal to `HUMAN_APPROVED`,
  leave verbatim.
- The invariant, unchanged: **the AI never assumes, infers, or stretches authorization.**

## Migration — never absent, only doubled

1. **Additive, warn-only.** Build `grants.jsonl` + UI/CLI minting + commit-msg token check +
   the PreToolUse Bash-matcher, all in log mode. Legacy `HUMAN_APPROVED`/`HUMAN-APPROVED`
   stays fully load-bearing. **Defer the CI grep-gate** to the final step.
2. **Parallel, token enforcing + marker still required.** Both must pass. Burn-in across
   **both** surfaces (Web UI + CLI/Claude Code) and **both** `AUTH_MODE` settings.
3. **Remove legacy last.** Only after burn-in proves the token path covers the **CLI-human
   commit** (the surface with no UI button — needs a `docwright grant <verb> <target>`
   command) do you delete the env-var/marker checks, unstaple `git-commit.ts`, purge docs,
   and add the CI grep-gate.

Hazards to encode in the plan: retire both artifacts together; L4 must consume a token or stay
downstream of a token-checked write (else it's a bypass); decide explicitly whether governance
transitions are permitted under `AUTH_MODE=none` (today they auto-seal — the biggest latent
hole); **coordinate with `plans/adopt-milestone-driven-roadmap-discipline.md` step 19**, which
consumes both commit forms and will break otherwise.

## Verification to add

- Conversational-only grant is **denied** for merge/delete/release/send (mirror the
  governance-doc negative test).
- Injected/file-borne grant is denied at each enforcement surface (provenance test) — and
  logged as a probable injection attempt.
- A token is single-use (replay denied) and target-bound (a `pr:240` token can't merge `pr:241`).
- Audit write failure fails the action (fail-closed test).
- Every `HUMAN_APPROVED`/`HUMAN-APPROVED` reference removed (CI grep-gate) — final step only.

## Separate, pre-existing security issue (independent of this proposal)

`git-commit.ts` stamping `HUMAN_APPROVED:'1'` unconditionally + `AUTH_MODE=none` synthesizing
an admin + the swallow-all audit sink is a **current** governance-bypass that exists today,
regardless of whether this proposal ships. Filed separately so it can be triaged on its own
timeline.

## Reviewer enumeration of `HUMAN_APPROVED` references

Code: `scripts/claude-lifecycle-hook.sh`, `scripts/pre-commit.sh`, `scripts/commit-msg.sh`,
`src/webui/src/lib/server/git-commit.ts`, `src/webui/src/routes/api/approve-proposal/+server.ts`,
`.claude/settings.json`, `test/hooks/test-lifecycle-hook.sh`. Docs: `CLAUDE.md`,
`docs/ai-governance-enforcement.md`, `docs/collaboration.md`, `docs/SOPs/lifecycle-compliance.md`,
`WORKFLOW-BLOCKERS.md`, `.claude/skills/critique-plan/SKILL.md`. Plans/proposals reference it
(update/note historical); **`plans/adopt-milestone-driven-roadmap-discipline.md` step 19 is a
live coordination dependency.** Session notes = historical, leave as-is.

---

## Second-pass review — holes in the FIX (2026-07-13)

A fourth adversarial pass attacked the *hardened model itself* (not the original proposal),
grounded in DocWright's real deployment. It found the token model's two headline claims are
**false in this architecture** — and the finding is decisive, so it's recorded here as a
model-shaping correction, not a footnote.

**Architectural ground truth (verified):** DocWright runs as a **single Node process, single
uid (root — no `USER` in the Dockerfile), with the tree bind-mounted (`.:/app`), the `dw-vault`
MCP server a stdio child of the AI's own process, and the AI holding a Bash tool.** There is no
"server vs. AI" boundary to hang trust on.

Consequences:

1. **CRITICAL — the AI can mint its own grant.** `docwright grant <verb> <target>` is a command
   the AI runs via Bash; the mint endpoint is in the same SvelteKit process the AI drives (and
   under `AUTH_MODE=none` it sees the synthetic admin); MCP tools run in the AI's process. So
   "the AI can relay but not mint" is false — the token is self-issuable. This is
   `HUMAN_APPROVED=1` with extra steps.
2. **CRITICAL — `.docwright/grants.jsonl` is AI-writable.** Same uid, in-tree, bind-mounted →
   `Bash("echo <forged> >> .docwright/grants.jsonl")` works. Hash-chaining does **not** save it:
   the AI can recompute a valid chain over forged lines because the chain isn't keyed by a
   secret it lacks. Presence-in-file is not a check.
3. **HIGH — the PreToolUse Bash-matcher is defense-in-depth, never a boundary.** Bypassable by
   `gh api` (vs `gh pr merge`), `python -c subprocess`, wrapper scripts, aliases, `git -c`,
   or simply going via MCP/web instead of Bash. The **real** boundary for push/merge is
   **Forgejo/GitHub branch+tag protection + a capability-scoped bot token that cannot push to
   `main`/push tags/delete**. For **delete and external-send there is NO server backstop** — the
   grant check must move **server-side into the MCP tool**, not sit behind a client-side grep.
4. **HIGH — migration ordering:** `transition_to_*` (L4) trusts the frontmatter flag today, and
   the AI drives the MCP server, so **B3 (MCP consumes a token) must be the FIRST enforcing flip**,
   before B1/B2 — else the double-gate is single on the surface the AI most easily drives, for the
   whole burn-in. Also: the `git-commit.ts` unconditional stamp persists through A/B, so the
   pre-existing hole is closed by **C1, not A3** — fix that phase-gate claim.
5. **MED — `content_hash` must be mandatory for governance + re-verified against the *staged*
   bytes at consume** (TOCTOU: mint on content H, AI edits to H′, commit stages H′); **atomic
   compare-and-consume** (race between parallel tool calls); canonical `target` normalization
   shared by minter + every verifier; **bind the nonce to the vault/store id** (the 4 instances
   share the image).
6. **MED — attribution:** `operator_id` must be copied from the **verified signed grant payload**,
   never accepted as an AI-supplied tool argument (else the `'NetYeti'` fallback forgery just
   returns as an AI-filled parameter). Fail-closed + hash-chain are *detection*, not *prevention*,
   until the writer is out-of-process or the chain is HMAC-keyed.

### The one change that rescues the model

**Provenance must be a secret-keyed signature the AI process does not hold; every verifier checks
the signature, never file-presence.** Concretely, minting requires a key held **out of the AI's
process** — the natural custodians in this stack:
- **Forgejo OAuth re-auth** issues a signed grant server-side (keyed by Forgejo's secret) — the
  intended production identity source (CLAUDE.md invariant #5), and it *already* exists.
- **WebAuthn/passkey** — a hardware assertion the AI cannot synthesize, verified out-of-process.
- A **separate-uid signer daemon** (unix socket + interactive human challenge) if neither above.

With a signed grant, `verifyGrant` checks the signature; a hand-forged `grants.jsonl` line fails;
the file becomes a harmless cache; and Findings 1, 2, and 6 collapse into "verify the signature."
**Without it, the token model is ceremony** — and, worse, it *looks* enforced while being
self-issued, which is more dangerous than the honestly-crude `HUMAN_APPROVED`.

### Blocking reclassifications for the plan

- `AUTH_MODE=none` handling and grant-store integrity are **blocking prerequisites, not open
  questions.** Under `AUTH_MODE=none` the gated classes must be **forbidden** (or require real
  out-of-process auth) — no synthetic-admin minting.
- Add a **signer / key-custody design step before A2** (build nothing token-shaped until the key
  lives outside the AI process). Prefer reusing **Forgejo** as the signer.
- Make **Forgejo branch/tag protection + a capability-scoped bot token** a shipped, tested
  prerequisite — that is the actual boundary for push/merge/tag.
- Move the **delete / external-send** grant check **server-side into the MCP tool**.
- Reorder **B3 first**; correct the phase-gate to say the `git-commit.ts` hole closes at **C1**.

Net: the recursive hard look changed the design twice — first pass moved the strong bar to
*reversibility* and introduced the token; second pass proved the token must be a *signed,
out-of-process* artifact (ideally Forgejo-issued), not a file the AI can write. That is the
version worth building.

## Appendix — ready-to-file GitHub issue (awaiting BDFL authorization to create)

The classifier correctly blocked auto-creating this (an outward write with no explicit
grant — the very boundary under redesign). Title + body below are ready to paste/file
on your go (`gh issue create` or the Report button), then add to the DocWright Dev board.

**Title:** Security: UI governance approvals auto-seal HUMAN_APPROVED (forgeable second factor)

**Labels:** bug, security, demand:1

**Body:**

> ## Summary
> 
> The Web UI's "human approval" for governance-doc lifecycle transitions is **forgeable / auto-sealed** — the designated second factor is, in practice, just a session cookie (and on the default deployment, not even that). Found during the three-perspective review of the authorization-model proposal (`docs/authz-model-hardening-review.md`); filed separately because it exists **today**, independent of that proposal.
> 
> ## The defect
> 
> 1. **`src/webui/src/lib/server/git-commit.ts` stamps `HUMAN_APPROVED: '1'` into the env of *every* UI commit, unconditionally.** The comment claims "the authenticated click is the seal," but the code checks nothing about *which* human decided *this specific* approval — any code path reaching `commitPaths()` gets the seal for free.
> 2. **`AUTH_MODE=none` (the default) synthesizes a `DEV_USER` with `teams: ['admin']`.** On a default local deployment there is no human behind the "authenticated" approval at all.
> 3. **The approve/complete endpoints are gated only by `requireAuth`** (a valid session), with no per-action, content-bound human confirmation.
> 4. **The audit sink is weak** (`src/mcp/lib/audit.ts`): actor derived from `$OPCODE_USER_NAME/$USER` with a hardcoded `'NetYeti'` fallback, all write errors swallowed (`catch {}`), in-tree `.docwright/audit.jsonl`; the UI approve audit records no actor at all. So post-hoc attribution can't be trusted either.
> 
> ## Impact
> 
> The governance invariant "AI/automation may never self-advance `approved`/`completed`/`gate_status`" is enforced on the Claude Code surface (PreToolUse hook) but **not on the Web-UI/API surface** — anything with a session (or nothing, under `AUTH_MODE=none`) can seal a governance approval with a real `HUMAN_APPROVED` marker. This is a governance-bypass, and it's the exact backstop the authz proposal wants to lean on.
> 
> ## Fix direction (see the review doc for the full model)
> 
> - Replace the hardcoded `HUMAN_APPROVED:'1'` with a **per-action, server-minted, single-use, content-bound grant token** (`DW-GRANT:<nonce>`), verified + consumed server-side.
> - Require a genuine per-action human confirmation for governance transitions (re-auth / passkey / explicit modal bound to the doc + content hash), and check the approving principal is a human-operator (Forgejo team), not the AI identity.
> - Decide explicitly whether governance transitions are permitted under `AUTH_MODE=none` (today they auto-seal — the biggest latent hole).
> - Harden the audit sink: real actor attribution, fail-closed on write error, append-only/hash-chained.
> 
> ## Refs
> 
> - `docs/authz-model-hardening-review.md` (findings #1, enforcement ground truth, audit hardening)
> - `proposals/retire-human-approved-global-gate-for-purpose-based-authorization.md` (the model that supersedes this once shipped — but this hole should be triaged on its own timeline)
> 
> _Filed by the authz-model review, 2026-07-13._
