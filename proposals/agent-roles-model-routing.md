---
title: "Scoped agent roles — capability-scoped subagents with per-role model routing (ai-stack bridge)"
author: NetYeti
author-role: contributor
created: 2026-07-05
tags:
  - agents
  - agent-roles
  - capability-scoping
  - model-routing
  - ai-stack
  - multi-perspective
  - governance
complexity: high
estimated_effort: L
priority: medium
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
development_branch: agent-roles
related_to:
  - proposals/deferred-sync-agents-cross-tool.md
  - policies/core/multi-perspective-review.md
  - policies/core/ai-governance-boundaries.md
  - policies/core/workflow-layer-governance.md
  - policies/core/code-over-memory.md
  - .claude/agents/docwright-lifecycle.md
  - .claude/agents/docwright-incident.md
milestone: backlog
---

> **⚠ Development happens on the `agent-roles` branch — not `main`.**
> See [Development Model](#development-model--parallel-branch-agent-roles)
> below. This document lives in `main` so the trunk stays aware of the
> parallel track; all implementation work belongs on `agent-roles`.

## Terminology note — "roles", not "personas"

Earlier drafts of this idea used a personality/persona metaphor. That
framing is deliberately retired (BDFL directive, 2026-07-05). What this
proposal actually specifies is a set of **capability-scoped agent
configurations**: a system prompt, a tool allowlist, and a model
assignment attached to a *function* — the same construct role-based access
control (RBAC) has described for decades, applied to AI instances. The
metaphor obscured the two mechanisms that make the design work
(capability scoping and work routing), invited unfounded anthropomorphic
claims in a public repository, and added nothing the accurate term does
not. Role titles below (Registrar, Critic, Surveyor…) name offices and
functions — as in "actor-critic" architectures or a county registrar —
not persons. Contributors and AI agents alike: keep this framing in all
derived documents, code, and discussion.

## Problem

DocWright's AI operating knowledge is spread across ~14 OpenCode skills,
13 agent rules, 9 core policies, ~30 MCP tools, and 5 Claude Code skills —
all loaded into a single generalist assistant per session. Four costs
follow from that flat structure:

1. **Governance by prompt, not by structure.** Any session can invoke any
   tool. Boundaries like "AI never approves" are enforced by the PreToolUse
   hook (good) and by prompt discipline (fragile). A subagent that simply
   *does not have* `transition_to_approved` or Bash in its tool allowlist
   is structurally incapable of violating its lane — the code-over-memory
   principle applied to agents themselves. `docwright-incident` already
   proves this pattern (Bash deliberately denied).

2. **Multi-perspective review is a discipline, not a mechanism.**
   [[policies/core/multi-perspective-review.md]] depends on a human
   remembering to ask a second model. There is no standing adversarial
   role, no routine "Critic pass" on plans and proposals.

3. **Enforcement drift from instruction overload.** Every session (Claude
   Code and especially OpenCode) loads all 13 rules, 9 policies, and the
   full skills table, then performs a task that touches perhaps three of
   them. Instruction-following measurably decays as context grows and
   unrelated instructions compete for attention — this is the observed
   root cause of recurring rule violations (self-approval attempts, direct
   plan writes, hand-filed issues), and it is worst on the smaller models
   OpenCode runs. A scoped role carries only the handful of rules that
   apply to *every* action it takes, in a short, fresh context:
   instruction density per token rises, drift falls, and when a role does
   drift it drifts inside a lane whose tools bound the blast radius.

4. **One model does all work, regardless of fit or cost.** A frontier
   generalist (Claude) drafts proposals *and* greps device inventories
   *and* formats commit messages. Smaller/cheaper models (Gemini Flash,
   Haiku) are better suited to narrow mechanical tasks, and local models
   via ollama (growlf/ai-stack + growlf/meshy) are better suited to
   privacy-sensitive or high-volume work — but DocWright has no routing
   layer that assigns work to the right model. This is also the missing
   bridge between the ai-stack project and DocWright: scoped roles give
   ai-stack's local inference endpoints a *defined job* inside the vault.

## Proposed Solution

Organize DocWright's AI assets into a set of **scoped agent roles**, each
with a bounded tool allowlist and a model assignment, under a shared
**constitution** layer that is never delegated to any one role.

### A. The role taxonomy (draft — to be refined via multi-AI review)

| Role | Domain | Key skills | Key MCP tools | Key rules/policies |
|---|---|---|---|---|
| **Registrar** (exists: `docwright-lifecycle`) | Document state machine | lifecycle, proposal, raw-proposal, templates | `write_plan`, `update_step`, `update_plan_status`, `set_plan_field`, `append_history`, `transition_to_*`, `approve_sub_plan` | lifecycle-gate, no-work-before-approval, frontmatter-validate, governance-writes, workflow-layer-governance, capture-deferred-ideas |
| **Release Warden** | Git, PRs, CI, versioning | git, issue-workflow | `start_issue_branch`, `complete_issue_branch`, `issue_preflight`, `sync_issue_file`, `create_step_issue`, `link_step_issue` | commit-format, ci-watch-on-tag-push, hook-failure-feedback, ui-test-before-submit, versioning, phase-closeout |
| **Security Auditor** | Audit, hardening, credential hygiene | security, tools | (read-mostly) | no-secrets, no-plaintext-creds, password-manager-first, ssh-config-only |
| **Surveyor** | Infra discovery, device YAMLs, backups | discovery, infra, backup | `scaffold_device_inventory`, `sync_device_inventory`, `list_device_inventories` | docwright-infra placement standards |
| **Incident Responder** (exists: `docwright-incident`) | P1–P4 response | (incident agent body) | (Bash denied — documents, does not mutate) | incident procedure |
| **Triage** | Bug/gap/idea capture and dedup | raw-proposal (intake side) | `capture_bug_report` (suggest→confirm→create), GH mirror | bugs-before-features, capture-deferred-ideas, one-off-formalization, BDFL capture directive |
| **Session** | Session bookends, orientation | session-start, endsession, project, status | `session_context`, `get_status`, `get_facts`, `next_action`, `list_active_plans` | (stays a **skill**, not a subagent — must run in main-conversation context) |
| **Critic** | Adversarial review of plans/proposals | critique-plan | `run_dry_run`, `collate` | multi-perspective-review, code-over-memory ("can this be a hook instead?") |

**The constitution (never a role):** ai-governance-boundaries (no AI
sets `approved: true`), workflow-layer-governance (MCP tools, never direct
plan writes), no-telemetry, dispatch-module invariants. These stay in
CLAUDE.md/AGENTS.md + hooks + dispatch-layer validation and bind *every*
role on *every* model.

### B. Per-role model routing (stretch goal — amended after Rounds 2–4)

> **Status (2026-07-05, post-Round 3):** OpenCode today has no per-agent
> `model:` in `.md` agent frontmatter, no per-agent MCP tool scoping, and
> no fallback chain for unreachable models (see
> [OpenCode Compatibility](#opencode-compatibility-sdk-support-vs-gaps)).
> The matrix below is a design target, **not** a committed spec. Committed
> scope is the single-model Critic pilot (§D); each routing row activates
> only when its condition in [Plan-Drafting Gates](#plan-drafting-gates)
> is met.

Match each role to the model class its work actually needs:

| Role | Model class | Rationale |
|---|---|---|
| Critic, Registrar | Frontier generalist (Claude) | Judgment-heavy: adversarial reasoning, lifecycle-rule interpretation |
| Release Warden, Triage | Small/fast hosted (Gemini Flash, Haiku) | Narrow, mechanical, high-frequency; latency and cost matter more than depth |
| Surveyor, Security Auditor | **Local via ollama (ai-stack/meshy)** | Handles device inventories, network topology, audit findings — data that should not leave the LAN; volume is high, tasks are structured |
| Incident Responder | Frontier by default, local fallback | P1 response cannot depend on internet reachability — a local model must be able to run the playbook during an outage |

Routing mechanics (research target, not yet committed): OpenCode agent
definitions already support per-agent model selection against any
OpenAI-compatible endpoint; meshy is the natural inference proxy in front
of ollama. The role definition becomes the unit of routing: one
canonical agent doc → per-surface frontmatter (Claude `tools:`, OpenCode
`permission:` + `model:`), generated by the sync layer proposed in
[[proposals/deferred-sync-agents-cross-tool.md]] (that proposal becomes a
prerequisite of this one).

**Security consideration (baseline, not retrofit):** heterogeneous models
mean heterogeneous hook support — a local ollama model does not run Claude
Code's PreToolUse hooks. Therefore constitution enforcement MUST live at
the MCP/dispatch layer (server-side validation in the dw MCP tools and the
pre-commit gate), not at the client harness. This is already DocWright's
stated design ([[policies/core/workflow-layer-governance.md]]); this
proposal makes it a hard requirement rather than one enforcement layer
among several. No role's model may be granted credentials broader than
its tool allowlist implies; local endpoints get LAN-only exposure per
docwright-infra standards.

**Amendment (Round 4 synthesis):** Rounds 2–3 showed this requirement
extends beyond the constitution to capability scoping itself. Neither
surface can enforce per-role tool allowlists client-side today — Claude
Code scopes built-in tools only; OpenCode scopes neither MCP tools nor
per-agent models (see OpenCode Compatibility). Therefore the dw MCP
server is the **primary** enforcement point for role scoping, not a
backstop: each session carries a role identity, and the MCP tools
themselves validate that the calling role is permitted the operation.
Client-side allowlists remain defense-in-depth where a harness supports
them, but no scoping claim in this proposal may depend on them.

### C. Multi-chat, multi-AI research process

Per [[policies/core/multi-perspective-review.md]], refine this proposal by
triangulation before any plan is drafted — a proposal about scoped roles
should itself be reviewed by multiple independent models:

1. **Round 1 — Claude (this thread's lineage):** taxonomy draft (done,
   captured above) + open questions below.
2. **Round 2 — Claude (Sonnet 4.6) via Cowork, independent context:**
   Critic pass on the drafted proposal (done — executed ahead of the
   originally planned BigPickle slot; see Research Log).
3. **Round 3 — BigPickle (OpenCode's configured LLM):** OpenCode-surface
   review — what the agent format actually supports today (done; see
   Research Log and
   [OpenCode Compatibility](#opencode-compatibility-sdk-support-vs-gaps)).
4. **Round 4 — Synthesis (Claude, Fable 5) + amendments:** fold Rounds
   2–3 back into the proposal body (done — this revision; append, don't
   rewrite history).
5. **Round 5 — Gemini via Antigravity (guest AI + third harness):**
   critique role granularity and the (now stretch-goal) routing matrix on
   the *amended* proposal. Rationale: Rounds 1–2 were both Claude-family
   models, so genuine model diversity is still owed; Gemini is a
   candidate assignee reviewing its own proposed lane; and Antigravity's
   agent/tool model adds a third harness perspective alongside Claude
   Code and OpenCode.
6. **Round 6 — a local ollama model via ai-stack:** dry-run the Surveyor
   or Triage role prompt on a small local model — the feasibility gate
   for the local-model routing rows.
7. **Promotion:** when stable, promote to a plan, subject to
   [Plan-Drafting Gates](#plan-drafting-gates).

Findings from each round land in the `## Research Log` section appended to
this proposal, dated, with the reviewing model named.

### D. Pilot — Critic as invocation layer (committed scope)

(Added Round 4, consolidating Round 2 f.2/f.6 and Round 3 f.1/f.6.)
The pilot implements exactly one role, the **Critic**, defined as the
invocation layer over the existing `scripts/critique-plan.js` +
`skill-plan-critique` flow — not a replacement for it. On OpenCode it is
implemented as an inline `agent:` block in `opencode.json` (the only
format supporting per-agent `model:` today), with a hand-mirrored
`.claude/agents/` definition; the sync-layer prerequisite is deferred
until after the pilot (resolving the two-paths question, Round 2 f.6 —
hand-mirror limit: the Critic only). The pilot validates, in order:

1. the inline-config pathway works end to end;
2. dispatch-layer role validation works — the Critic's MCP calls are
   identified and checked server-side (§B amendment);
3. the Critic produces review value beyond invoking the bare script.

Only after all three pass does taxonomy build-out begin. This also
resolves the Critic bootstrapping dependency (Round 2 f.2): the amended
proposal has been critiqued by independent models before the Critic role
exists, and a **Critic self-review of this proposal is required before
any second role ships**.

### Role / skill / hook — decision criterion

(Added per Round 2 f.3 and Round 3 f.5.) For each candidate behavior,
apply in order — first match wins:

1. **Hook / CI check / dispatch validation** — if the rule is
   mechanically decidable, enforce it in code and stop
   ([[policies/core/code-over-memory.md]]). No role.
2. **Skill** — if it is a procedure that must run in main-conversation
   context (session bookends) or is only ever invoked inside another
   flow.
3. **Role (subagent)** — only if it needs all three: (a) a distinct tool
   surface enforceable at the dispatch layer, (b) isolation benefit
   (short fresh context, high instruction density), and (c) recurring
   standalone invocation.

Applied to the draft taxonomy: Session confirmed a skill; Triage likely
fails (c) and becomes a hook-triggered skill; the Surveyor + Incident
Responder merge stays open; the taxonomy is expected to shrink. Whether
survivors are real subagents or dispatched behavioral roles inside fewer
agents (Round 3 f.5) is settled by the pilot: if scoping is enforced
server-side, the count of client-side agent definitions becomes an
ergonomics choice, not a security one.

### OpenCode Compatibility (SDK support vs. gaps)

As of `@opencode-ai/sdk v1.15.13` (Round 3, BigPickle — verified against
`AgentConfig` types, `.opencode/agents/*.md`, and local config):

| Capability the proposal needs | OpenCode support today |
|---|---|
| Per-agent `model:` in `.opencode/agents/*.md` frontmatter | **Absent** — `model` exists only on inline `agent:` blocks in `opencode.json` |
| Per-agent MCP tool allowlists | **Absent** — `permission` scopes built-in tools only; MCP tools are global to all agents |
| `tools: { skill: true }` enforcement | **Absent** — DocWright-custom field, not engine-enforced |
| Per-agent small/fast model routing | **Absent** — `Config.small_model` is one global string |
| Fallback chain on model unreachability | **Absent** — local-model roles stop hard when ollama is down |
| Hierarchical permissions for 7+ distinct allowlists | **Absent** — two privilege levels, no MCP scoping |

Consequence: every structural-scoping claim in this proposal is delivered
at the dispatch/MCP layer (§B amendment) or not at all. The gaps above
are tracked as upstream-contribution candidates but sit off the critical
path.

### Plan-Drafting Gates

No plan is drafted from this proposal until (consolidated from Rounds
2–4):

1. **Dispatch-layer role enforcement is designed** — the mechanism by
   which dw MCP tools identify and validate the calling role (Round 2
   f.1; Round 3 f.2/f.3). *Draft: Annex A.1–A.3, pending Round 5 review.*
2. **Routing-drift countermeasure is specified** — how main-session work
   gets routed to roles instead of done in place, with named detection
   heuristics (Round 2 f.1). *Draft: Annex A.4, pending Round 5 review.*
3. **Data classification is decided** — which roles' data may be sent to
   which endpoints (hosted vs. LAN); gates every hosted-small-model
   routing row (Round 2 f.5). *Draft: Annex B; **all eight BDFL rulings
   recorded 2026-07-10** (see B.2), pending Round 5 review.*
4. **The Critic pilot passes** its three validations (§D).
5. **Local-model rows only:** Round-6 ollama dry-run transcripts attached
   to the Research Log (Round 2 f.4) — gates those rows' activation, not
   the plan itself, since the routing matrix is now a stretch goal.

### Exit criteria

(Added per Round 2 f.8.) The experiment is re-scoped or abandoned — the
`agent-roles` branch archived and salvageable pieces captured as deferred
proposals per [[policies/core/capture-deferred-ideas.md]] — if any of:
the Critic pilot cannot pass its three validations; dispatch-layer role
validation proves impractical without forking OpenCode; or two
consecutive research rounds conclude the taxonomy adds process weight
without measurable drift reduction. Failure must be as legible as
success.

## Annex A — Gate 1/2 design draft (dispatch-layer role identity)

*(Round 4 addendum, **Round 5-reviewed 2026-07-10**. Gemini surfaced
one CRITICAL bug (f.3, filed) and three hardening requirements now
folded into A.2 (call-time validation mandatory, argument-level
scoping) and A.5 (audit log is not tamper-proof). This is the security
architecture the whole proposal rests on, so it gets the same
multi-perspective treatment as the taxonomy. Grounded in the actual
`src/mcp` implementation as of 2026-07-05.)*

### A.1 Identity binding — spawn-time, never model-assertable

Role identity is set by **configuration at server spawn**, following the
existing `DOCWRIGHT_CONTRIB_APPROVED=1` precedent (env-only, unforgeable
from inside the conversation): `DOCWRIGHT_ROLE=<role>` (or `--role`) in
the agent definition's MCP server config. The model can never assert or
switch its own role — no `begin_role_session(role)` tool, deliberately:
any identity a model can claim, a drifting model can claim wrongly.

The dw server runs stdio (per-client process) or SSE (shared :3100).
Stdio is a natural fit — each agent definition spawns its own server
process carrying its role env. **The pilot uses per-role stdio only.**
Per-connection role identity on shared SSE is explicitly deferred (see
A.5).

### A.2 Two-layer enforcement in the server

1. **Advertisement filtering.** Registration of the 34 tools is
   currently static; with `DOCWRIGHT_ROLE` set, the server registers
   only that role's allowlist. A scoped role cannot see out-of-lane
   tools — structural incapability, not refusal.
2. **Call-time validation.** Every `CallToolRequest` is additionally
   checked against the role matrix (defense in depth: clients cache
   tool lists; SSE may not filter).

The role→tool matrix lives in a schema-validated **role manifest**
(`src/mcp/roles.json`, or per-profile with vault override — Round 5
question), making role scope policy-driven, not hardcoded. CI asserts no
role's list contains a constitution-violating tool (already in
Verification).

**R5 hardening requirements (Gemini f.4/f.5, accepted):**
- *Call-time validation is not optional.* A single client multiplexer
  over stdio servers means a drifting Generalist can attempt tools
  registered for other roles; advertisement filtering (layer 1) alone
  does not stop this. Layer 2 must key off the **server-side** role
  bound at spawn, never the client-selected tool, and reject any call
  whose tool is outside the spawned role's lane.
- *Argument-level scoping.* The manifest must constrain tool
  **parameters**, not just tool names — otherwise a permitted tool
  (e.g. a file or git operation) can still reach arbitrary paths or
  actions. This is the same exploit surface as the paths.ts traversal
  bug (f.3); path/ref arguments are validated against the role's
  allowed scope before dispatch.

### A.3 Constitution stays global and can only be narrowed

The existing server-side guards — blocked frontmatter fields
(`approved`, `status`, `gate_status`, …), human-approval gates — apply
to **every** role including the generalist. The role manifest can only
narrow capability below the constitution ceiling, never widen it.

### A.4 Gate 2 — routing-drift countermeasure

The main session (no `DOCWRIGHT_ROLE`) runs the **generalist** profile:
queries, capture, and utility tools — but role-laned mutation tools
(lifecycle transitions, plan mutations, issue-branch operations) are
absent from its registration. Main-session lifecycle work then fails
structurally at the first mutation, forcing delegation to the Registrar
et al. Detection: every `audit.jsonl` event gains a `role` field (and a
`model` field — this is the V1 `ai-last-action` stamping vehicle from
Verification); a CI/endsession check scans for laned mutations with a
missing or wrong role. Rollout: warn-only first, then deny — the
warn-period audit data is also the baseline that makes the exit
criterion "measurable drift reduction" measurable.

### A.5 Honest limits and threat model

- **Trust boundary is the config file + process spawn.** Anything able
  to edit `opencode.json`/`.mcp.json` or spawn processes can claim any
  role — including a role whose own allowlist grants Bash. Mitigations:
  agent configs are git-tracked and human-reviewed; Bash-bearing roles
  are the exception; the pre-commit gate remains the backstop.
- **Direct file writes bypass MCP entirely.** Dispatch-layer is the
  primary enforcement point, not the only one — the pre-commit gate and
  (where available) client hooks stay.
- **`model` in the audit stamp is asserted by config, not proven.**
  Adequate for drift analytics, inadequate for forensics; noted.
- **The audit log is not a tamper-proof boundary (R5 f.6).**
  `audit.jsonl` is a local file and can be edited; it is
  drift-analytics/observability, explicitly **not** a forensic or
  tamper-evident trust anchor. Hardening (append-only store, signing)
  is deferred and documented, not assumed.
- **Fail closed:** if a role's server or model is unreachable, laned
  operations do not fall back to the generalist.
- **Deferred:** per-connection identity on shared SSE (per-role ports?
  auth header? one process per role?) — needed before any multi-role
  Web-UI surface, not for the pilot.

## Annex B — Gate 3 draft: per-role data classification

*(Round 4 addendum. Status: **BDFL rulings recorded 2026-07-10** — all
eight rows ruled as recommended, including both B.3 findings (Triage
withdrawn to LAN-only; Incident Responder frontier as documented
exception). **Round 5-reviewed 2026-07-10:** Triage rebuttal (Gemini
f.7, SET regex scrub) recorded but not adopted — LAN-only stands
pending a scrub-recall proof (see Future); Incident Responder exception
refined to a time-boxed lease (f.8).)*

### B.1 Data classes

| Class | Definition | Max endpoint tier |
|---|---|---|
| **C1 Public** | Content already public (DocWright repo on main: code, policies, public proposals) | Any endpoint |
| **C2 Vault-internal** | Private vault content: org proposals, plans, session notes, member names | Hosted frontier under contracted provider terms; hosted-small and below per vault-owner ruling |
| **C3 Infrastructure-sensitive** | Device inventories, IPs/MACs, topology, audit/vulnerability findings, incident details | **LAN-only** (local models via olla/LiteLLM) |
| **C4 Secrets** | Credentials, tokens, keys | **No model context, ever** — not even local. Runtime `bw` retrieval by humans/scripts only; a secret in a prompt is an incident |

Classification is **per-vault, not global**: DocWright-the-repo is
mostly C1, but adopter vaults (Cascade STEAM, MSP) are C2+ by default.
Mechanism: the vault profile declares its default class; the Annex A
role manifest gains a `max_endpoint_tier` per role; routing validates
role × vault-class × endpoint before dispatch — code, not memory.

### B.2 Role rulings

| Role | Data it handles | Class | Ruled endpoint ceiling | BDFL ruling |
|---|---|---|---|---|
| Registrar | Frontmatter, lifecycle state, doc bodies | C1–C2 | Hosted frontier | ☑ 2026-07-10 |
| Critic | Full plans/proposals | C1–C2 | Hosted frontier | ☑ 2026-07-10 |
| Release Warden | Commits, PRs, CI status | C1 (public repo) / C2 (private vaults) | Hosted-small for C1 vaults; frontier for C2 | ☑ 2026-07-10 |
| Session | Status, orientation, session notes | C2 | Hosted frontier (runs in main context anyway) | ☑ 2026-07-10 |
| Triage | Bug reports, logs, stack traces | C2 **with C3/C4 leakage risk** — see B.3 | **LAN-only** — Gemini Flash assignment withdrawn; **not hosted-small** | ☑ 2026-07-10 |
| Surveyor | Device YAMLs, IPs, topology | C3 | LAN-only (confirms matrix) | ☑ 2026-07-10 |
| Security Auditor | Vulnerability and audit findings | C3 (highest sensitivity) | LAN-only (confirms matrix) | ☑ 2026-07-10 |
| Incident Responder | Incident details incl. topology/vuln info | C3 | **Frontier as documented standing exception** — see B.3(2), option (b) | ☑ 2026-07-10 |

### B.3 Two findings that push back on the §B routing matrix

1. **Triage on Gemini Flash is not classification-safe.** Bug reports
   and pasted logs routinely embed IPs, hostnames, and occasionally
   secrets — C3/C4 material arriving unlabeled inside C2 traffic. The
   matrix's "small/fast hosted" assignment for Triage should be
   withdrawn unless a mechanical redaction pass (patterns: IP/MAC/key
   formats) runs before egress. Recommended: LAN-local Triage, which
   also gives cluster-llm a high-volume, low-stakes proving lane.
   **Ruled 2026-07-10: adopted.** Gemini Flash assignment withdrawn;
   Triage runs LAN-local. Round 5 may still rebut (it is Gemini's own
   candidate lane); a successful rebuttal reopens the row.
2. **Incident Responder needs an explicit exception ruling.** The
   matrix says "frontier by default, local fallback" — but incident
   context is C3. Options: (a) strict — LAN-only, accept weaker
   judgment during incidents; (b) exception — frontier permitted under
   contracted provider terms because response quality is
   safety-relevant, hosted-small never, local fallback mandatory for
   connectivity loss. Recommended: (b), recorded as a standing,
   documented exception rather than a silent default.
   **Ruled 2026-07-10: option (b) adopted.** Frontier permitted under
   contracted provider terms; hosted-small never; local fallback
   mandatory. This row is the sole standing exception to the C3
   LAN-only rule and must appear as such in the role manifest.
   **R5 refinement (Gemini f.8, accepted):** the exception should be a
   **time-boxed lease tied to an active incident**, not a permanent
   flag — a standing exception invites frontier use during
   non-incident states. Mechanism (lease token / expiry) is a
   plan-stage detail; the ruling stays option (b), now leased.

## Development Model — parallel branch `agent-roles`

This is a large direction change. It develops on a **long-lived parallel
branch, `agent-roles`**, in the same way `dogfood` runs parallel to
`main` — until the approach is mature and fully vetted as a real
direction change for DocWright. Rules of the road, binding on humans and
AI agents alike:

1. **All implementation happens on `agent-roles`, never on `main`.** Any
   AI session picking up work related to this proposal must first verify
   it is on the `agent-roles` branch (or a feature branch cut from it).
   If you are on `main` and the task is role-implementation-shaped: stop
   and switch.
2. **Only governance documents flow back to `main`** — this proposal and,
   when they land, the plan files derived from it. They travel on
   short-lived `docs/agent-roles-*` PR branches so the trunk stays aware
   of the parallel track without absorbing its code.
3. **Pull from `main`/releases selectively and non-destructively.** Merge
   or cherry-pick trunk work into `agent-roles` when it *helps* this
   track. Skip it when `main` solves the same problem a different way —
   divergence here is expected and intentional, not drift to be
   "fixed". Never let a sync from `main` clobber branch work; resolve in
   favor of the branch's design and note the divergence in the Research
   Log.
4. **Merging `agent-roles` into `main` is a BDFL decision**, taken only
   when the approach is vetted (research rounds complete, pilot role
   verified, constitution enforcement confirmed at the dispatch layer).
   Until then the branch does not PR wholesale into `main`.
5. The long-lived branch name is exempt from the typed-prefix convention
   (which CI enforces only on PRs targeting `main`, which this branch
   never does wholesale) — precedent: `dogfood`.

## Open Questions (research targets)

*(Round 4 annotations mark questions resolved, elevated to gates, or
narrowed by Rounds 2–3. Original text retained.)*

- **Granularity:** 7 roles or fewer? Surveyor + Incident Responder may
  merge (same domain, different tempo). Triage may be too thin to be an
  agent vs. a hook-triggered skill.
  *→ Partially resolved (R4): decision criterion added (§ Role / skill /
  hook); taxonomy expected to shrink; merge question stays open for
  Round 5.*
  *→ Resolved (R5 f.1/f.2): Surveyor and Incident Responder stay
  separate (different tempos + Annex B data boundary). Triage stays an
  agent, not a hook-skill — and this refutes the decision criterion,
  which needs a data-isolation override clause (a role can be warranted
  purely to keep high-risk data out of the Generalist's context).*
- **Routing layer:** OpenCode per-agent `model:` vs. meshy-side routing
  vs. both. What happens when the assigned model is unreachable — fallback
  chain per role?
  *→ Narrowed (R3): only inline `agent:` config supports per-agent
  `model:` today; fallback chains don't exist in OpenCode — now a
  must-implement behind the stretch-goal matrix, not an open choice.*
- **Capability floor:** which roles are actually executable on 7–13B
  local models? Needs empirical dry-runs (Round 4), not assumptions.
- **Constitution portability:** exact mechanism for enforcing governance
  boundaries on models that run no client hooks — is dispatch/MCP-side
  validation already complete, or are there gaps (e.g. direct git access)?
- **Cost/telemetry tension:** hosted small models (Gemini) send vault
  content off-LAN. Which roles' data is acceptable to send where? May
  need a per-role data classification.
  *→ Elevated (R2 f.5): now Plan-Drafting Gate 3 — a security
  architecture decision, not an open question.*
  *→ Ruled (2026-07-10) + tested (R5 f.7): all eight B.2 rows ruled.
  Gemini's SET-scrub rebuttal for Triage is feasible but not adopted —
  regex scrubbing's failure mode is an unlogged secret leak, so the
  LAN-only ruling stands pending a separate proposal that proves scrub
  recall. See Future.*
- **Sync prerequisite:** does [[proposals/deferred-sync-agents-cross-tool.md]]
  need to land first, or can the first new role (Critic) be hand-mirrored
  as a pilot?
  *→ Resolved (R4, per R2 f.6 + R3 recommendation): hand-mirror pilot
  first, limited to the Critic; sync layer deferred until after the
  pilot. See §D.*
- **Routing drift (the failure mode moves up a level):** capability
  scoping fixes in-lane drift but creates a new one — the main session
  doing lifecycle-shaped work itself instead of delegating to the
  Registrar. Trigger/detection heuristics in agent descriptions become
  load-bearing; do they eventually need their own enforcement (e.g. a
  hook that flags role-lane mutations performed outside that role)?
  *→ Elevated (R2 f.1): now Plan-Drafting Gate 2 — the central failure
  mode of the design, must be specified before any plan.*
- **Prompts are still prompts:** role prompts improve compliance; only
  tool scoping + MCP/dispatch-side validation make violations impossible.
  Where exactly is the line between what scoped roles *reduce* and what
  the constitution layer must still *prevent*?

## Alternatives Considered

- **Keep the flat generalist model + skills.** Rejected: leaves
  multi-perspective review as human discipline, leaves governance
  boundaries prompt-enforced, and gives ai-stack no defined role.
- **Model routing without scoped roles** (route by task type ad hoc).
  Rejected: routing needs a stable unit of assignment; roles provide
  the contract (tools + rules + model) that makes routing auditable.
- **Scoped roles without model routing** (all on Claude). Viable as
  Phase 1 — the taxonomy and tool-scoping benefits stand alone — but
  abandons the cost/privacy/ai-stack goals; treat single-model as the
  pilot stage, not the end state.
- **Persona/personality framing.** Rejected 2026-07-05 — see Terminology
  note. Anthropomorphic framing is inaccurate (no claim of personhood is
  made or warranted), obscures the actual mechanisms (RBAC-style
  capability scoping + work routing), and would invite avoidable
  credibility arguments in a public repository.

## Verification

- Each role ships with a test: invoke it with an out-of-lane request
  (e.g. ask the Critic to approve a plan) and assert structural refusal
  (tool absent), not just polite refusal.
- CI check (extends the deferred sync proposal): every role has
  matching `.opencode/agents/` and `.claude/agents/` definitions, and no
  role's tool list includes a constitution-violating tool.
- Round-6 dry-run transcripts for local-model roles are attached to the
  Research Log before any local routing is enabled.
- Role-level audit stamping ships **with the pilot**, not later:
  `ai-last-action:` records the role and model that performed each action
  (moved from Future per Round 2 f.7 — it is the observability that makes
  routing drift detectable at all).
- Dispatch-layer role validation has its own negative test: an MCP call
  carrying the wrong (or no) role identity for a scoped operation is
  rejected server-side, on every surface, hooks or no hooks.
- **Path containment (R5 f.3):** `src/mcp/lib/paths.ts` gets a single
  canonical containment helper (`path.relative` + `..`/absolute
  rejection) applied in **every** exported function, with unit tests
  for the sibling-prefix and unchecked-helper cases. This bug
  (`issues/bug-mcp-pathsts-...`) is resolved before the Critic pilot
  ships, per bugs-before-features.
- **Argument-scoping test (R5 f.5):** a scoped role calling a permitted
  tool with an out-of-lane path/ref argument is rejected server-side.

## Future

- **SET (Sanitized Egress for Triage) — follow-up proposal (R5 f.7).**
  Gemini's rebuttal that a local regex scrub of C3/C4 formats (IP, MAC,
  base64, hostnames) could safely route Triage logs to hosted-small is
  plausible but unproven; the failure mode is an unlogged secret leak
  on a regex miss. Capture as a separate `priority`-tracked proposal:
  prove scrub recall against a corpus of real bug reports/logs, then
  reopen the B.2 Triage row. Until then Triage stays LAN-only. (Per
  capture-deferred-ideas — the good idea is set aside, not lost.)
- Bundle the role set as part of DocWright profiles, so adopting
  organizations (Cascade STEAM first) get the roles + routing matrix as a
  governed default — the multi-perspective philosophy transmitted as
  code, not advice.
- Upstream contributions to OpenCode closing the gaps in
  [OpenCode Compatibility](#opencode-compatibility-sdk-support-vs-gaps)
  (per-agent `model:` in `.md` frontmatter, per-agent MCP tool scoping,
  fallback chains).
- ~~Role-level audit stamping~~ — moved to Verification (V1, ships with
  the pilot) per Round 2 f.7.

## Research Log

- **2026-07-05 — Claude (Fable 5), Round 1:** Initial taxonomy from full
  asset inventory (14 skills, 13 rules, 9 policies, ~30 MCP tools, 2
  existing agents). Key findings: constitution vs. role split;
  tool-allowlist scoping as code-over-memory applied to agents; Critic and
  Triage are highest-leverage additions; Session stays a skill; hook
  heterogeneity forces constitution enforcement to the MCP/dispatch layer.
- **2026-07-05 — Claude (Fable 5), Round 1 addendum (with BDFL):** Reframed
  enforcement as a primary motivation (Problem #3): instruction overload —
  all rules/policies loaded into every session — is the root cause of
  recurring rule drift, worst on OpenCode's smaller models. Scoped roles
  fix it via three mechanisms: structural incapability (tool absence beats
  remembered rules), instruction density (few rules, all applicable, short
  fresh context), and bounded blast radius. Two caveats logged as open
  questions: routing drift (main session bypassing roles) and the
  roles-reduce vs. constitution-prevents boundary. Capability scoping is
  also the feasibility prerequisite for the local-model routing rows —
  a small model can follow a focused role prompt but not the full
  ruleset. BDFL confirms direction; OpenCode (BigPickle) review is next
  (Round 2).
- **2026-07-05 — BDFL directive: de-anthropomorphize.** Terminology
  changed from "personas/personalities" to "scoped agent roles"
  throughout (see Terminology note). Softened role titles: Intake Clerk →
  Triage, Security Officer → Security Auditor, Concierge → Session.
  Rationale: accuracy (these are prompt + toolscope + model
  configurations, nothing more), RBAC/actor-critic precedent, and
  public-repository credibility. Development model also set: long-lived
  parallel branch `agent-roles` (dogfood precedent), governance docs only
  flowing back to `main`, selective non-destructive forward-pulls,
  wholesale merge deferred to BDFL vetting.
- **2026-07-05 — Claude (Sonnet 4.6) via Cowork, Round 2 — Critic pass
  (independent context, no memory of drafting session):** Eight findings
  across two severity tiers. Three flagged as plan-drafting gates:
  (1) **Routing drift** — "main session bypasses Registrar" is the central
  failure mode of the design, not an open question; dispatch mechanism must
  be defined before a plan is drafted. (4) **Round 4 local-model dry-run**
  — currently optional but its failure collapses the Surveyor/Security
  Auditor rows; must become a hard gate on proposal approval, not just on
  implementation. (5) **Data classification** — "which roles' data goes
  where" is a security architecture decision disguised as an open question;
  resolving it constrains the hosted-small-model rows before the plan is
  written.
  Medium findings: (2) Critic bootstrapping dependency — the Critic role
  was not reviewed by the mechanism it creates; a Round 5 (Critic
  self-review post-implementation) should be required before further roles
  ship. (3) No role/skill/hook decision criterion — taxonomy is intuitive,
  not principled; a stated criterion must be defined and applied to each
  entry. (6) Two implementation paths (sync prerequisite vs. hand-mirror
  pilot) with no decision point or hand-mirror limit named. (7) Role-level
  audit stamping (`ai-last-action:` + role + model) is in Future but
  belongs in V1 verification criteria. Low: (8) No exit criteria for the
  experiment — failure conditions should be as explicit as success criteria.
  Full finding table recorded in Cowork session. BDFL direction: log entry
  first, then OpenCode (BigPickle) Round 3 review, then amendments.
- **2026-07-05 — BigPickle (OpenCode's configured LLM) via OpenCode, Round 3
  — OpenCode-surface review of agent taxonomy and model-routing
  assumptions:** Reviewed proposal against actual OpenCode agent support
  (inspected `.opencode/agents/*.md`, `AgentConfig` type definitions from
  `@opencode-ai/sdk v1.15.13`, and all config files). Nine findings across
  three tiers.
  **Block — must resolve before plan drafting:**
  (1) **Per-agent model assignment impossible in `.md` frontmatter.**
  `.opencode/agents/*.md` has no `model` field in YAML frontmatter —
  `model` only exists on `AgentConfig` in inline `agent:` blocks within
  `opencode.json`. Every DocWright subagent uses the `.md` format. The sync
  layer must either migrate to inline config, extend frontmatter schema,
  or both. Without this, the model-routing matrix has no implementation
  path on OpenCode. Gate the pilot on confirming at least one pathway works.
  (2) **No MCP tool access scoping exists.** `permission` scopes only
  built-in tools (edit, bash, webfetch, doom_loop, external_directory).
  MCP tools are globally available to every agent — no per-agent allowlist.
  There is no way to say "Critic has `run_dry_run` and `collate` but not
  `update_plan_status`." Until this exists, capability scoping rests on
  prompt discipline alone — the very thing the proposal aims to replace.
  (3) **`tools: { skill: true }` is custom, not engine-enforced.** Both
  existing subagents use `tools: { skill: true }` — a DocWright-custom
  extension field, not the standard `AgentConfig.tools: { [name]: bool }`
  format. The OpenCode engine does not enforce it. The tool-allowlisting
  in the role taxonomy is aspirational.
  **Warn — likely to cause problems; address before starting:**
  (4) **Small/fast model routing is global, not per-agent.**
  `Config.small_model` is a single global string — no per-agent equivalent.
  The model-routing matrix is a visualization of intent, not a spec of
  OpenCode capability. Move "Routing layer" from open question to
  must-implement. (5) **No hierarchical permission model for tools.** 7+
  roles with distinct tool allowlists cannot be modeled in a system with
  two privilege levels and no MCP tool scoping. Determine whether roles
  should be actual OpenCode subagents or dispatched behavioral roles within
  a smaller number of real agents. (6) **Critic role overlaps existing
  `skill-plan-critique`.** The completed critique skill uses
  `scripts/critique-plan.js` + human review and is model-agnostic. A Critic
  subagent duplicates this in a model-specific harness — define the Critic
  as the invocation layer for the existing script, not a replacement.
  **Note — worth considering:**
  (7) `docwright-incident` proves capability scoping for `bash` only — not
  for the wider MCP tool scoping the taxonomy requires. (8) No fallback
  chain for model unreachability exists in OpenCode; when ollama is down,
  local-model roles stop with no graceful degradation. (9) `assigned_to`
  and role assignment collide — "Registrar" and "Critic" as roles conflict
  with `assigned_to: NetYeti` as a separately defined concept.
  **Round 3 summary:** Three hard blocks (no per-agent model in `.md` format,
  no MCP tool scoping, custom `tools:` field unenforced) mean the proposal's
  core structural guarantee cannot be delivered on OpenCode today. Recommend
  a pilot Critic role implemented via inline `agent:` config in
  `opencode.json` (bypassing the `.md` format gap) to validate the full
  stack before committing to the 7-role taxonomy. Recommend adding an
  `## OpenCode Compatibility` section documenting SDK support vs. gaps, and
  shifting the model-routing table from design spec to stretch goal behind
  identified SDK gaps.
- **2026-07-05 — Claude (Fable 5) via Cowork, Round 4 — synthesis +
  amendments:** Rounds 2–3 converge on one conclusion: the proposal's
  structural guarantee ("cannot violate its lane") exists today only on
  Claude Code, and only for built-in tools — R2's routing-drift gate and
  R3's three blocks are the same finding at two levels. The proposal's
  own §B security consideration already contained the fix, under-weighted:
  since no client harness can enforce role scoping, the dw MCP/dispatch
  layer is promoted from constitution backstop to **primary scoping
  mechanism** (role identity per session, validated server-side by the
  tools themselves) — which dissolves R3 blocks 2–3 rather than waiting
  on upstream SDK features. Amendments made in this revision: §B routing
  matrix demoted to stretch goal behind a status banner; §B amendment
  paragraph (dispatch-layer scoping primary); new §D committed-scope
  Critic pilot (invocation layer over `critique-plan`, inline `agent:`
  config, hand-mirror limited to Critic, three validations, Critic
  self-review required before second role — resolves R2 f.2/f.6, R3
  f.1/f.6); new role/skill/hook decision criterion (R2 f.3, R3 f.5); new
  `## OpenCode Compatibility` gap table (R3 recommendation); new
  `## Plan-Drafting Gates` (5 gates consolidating R2 f.1/f.4/f.5, R3
  f.2/f.3); new `## Exit criteria` (R2 f.8); role-level `ai-last-action:`
  stamping moved Future → Verification V1 (R2 f.7); §C round plan
  renumbered to match actuals — Gemini via Antigravity becomes Round 5
  (on the amended doc; also restores model diversity, since Rounds 1–2
  were both Claude-family), local ollama dry-run becomes Round 6. Open
  questions annotated with resolution status; original text retained.
  Still open for Round 5: role granularity / Surveyor–Incident merge,
  routing-drift countermeasure design (gate 2), data classification
  (gate 3), `assigned_to`-vs-role collision (R3 f.9).
- **2026-07-05 — Round 4 addendum (with BDFL): Round 6 rig identified.**
  A LAN GPU host (RTX 3090, 24GB VRAM, ~64GB RAM) managed in a separate
  private infrastructure vault is available for the Round 6 local-model
  dry-run, already fronted by an OpenAI-compatible proxy stack with
  24–32B-class quantized models pulled. This raises the tested capability
  floor from the assumed 7–13B (ai-stack Xe iGPU) to 24–32B, materially
  improving the odds for the local-model routing rows — the floor
  question becomes "which tier", not "whether". Conditions carried over
  from the security consideration: the model process receives no
  repository credentials; endpoints stay LAN-only/SSH-tunneled; any
  vault-write experiment goes through dw MCP tools so dispatch-layer
  validation (Gate 1) is exercised by the dry-run itself. Rig setup is
  captured as a templated proposal in the infrastructure vault (host
  details deliberately kept out of this public repo). Sequencing
  unchanged: Round 5 (Gemini) first, then Round 6 on this rig.
- **2026-07-05 — Claude (Fable 5) via Cowork, Round 4 addendum: Annex A
  drafted (Gates 1–2 design).** Dispatch-layer role identity designed
  against the actual `src/mcp` implementation (stdio/SSE transports, 34
  statically registered tools, existing env-only `DOCWRIGHT_CONTRIB_APPROVED`
  precedent, `audit.jsonl`). Core decisions: role identity is spawn-time
  configuration (`DOCWRIGHT_ROLE`), never model-assertable — no
  role-selection tool exists by design; two-layer enforcement
  (registration filtering + call-time validation against a
  schema-validated role manifest); constitution guards stay global,
  manifest can only narrow; generalist profile without laned mutation
  tools is the Gate 2 routing-drift countermeasure, with `role` + `model`
  fields added to `audit.jsonl` (doubling as the V1 `ai-last-action`
  stamp and the drift-measurement baseline); fail closed on unreachable
  role servers; SSE per-connection identity deferred past the pilot.
  Honest limits recorded in A.5 (config-file trust boundary, MCP bypass
  via direct writes, asserted-not-proven model stamp). Annex A is a
  Round 5 review target, added to the Gemini briefing as scope item 5.
- **2026-07-05 — Claude (Fable 5) via Cowork, Round 4 addendum: Annex B
  drafted (Gate 3, per-role data classification).** Four data classes
  (C1 public → C4 secrets-never-in-context), per-vault not global, and
  a role→endpoint-ceiling table with a BDFL ruling slot per row (AI
  recommends, does not decide egress policy). Mechanism ties into the
  Annex A role manifest via `max_endpoint_tier`, validated in code
  before dispatch. Two findings push back on the §B matrix: Triage on
  hosted-small is not classification-safe (logs leak C3/C4 material —
  recommend LAN-local Triage, which also gives the Round 6 rig a
  standing lane) and Incident Responder's frontier-by-default needs an
  explicit documented exception ruling rather than a silent default.
- **2026-07-10 — BDFL (with Claude Fable 5 via Cowork): all eight B.2
  rulings recorded.** Every row ruled as recommended: Registrar, Critic,
  Session at hosted frontier; Release Warden tiered (hosted-small C1 /
  frontier C2); Surveyor and Security Auditor LAN-only. Both B.3
  findings adopted — Triage's Gemini Flash assignment withdrawn in
  favor of LAN-local (giving cluster-llm its standing high-volume
  lane), and Incident Responder granted frontier access as the sole
  documented standing exception to the C3 LAN-only rule (contracted
  provider terms; hosted-small never; local fallback mandatory). Gate 3
  now awaits only Round 5 review; the Triage row reopens if Gemini's
  rebuttal (briefing scope item on its own candidate lane) succeeds.
  Note: Round 5 (due 7/8) has not yet landed as of this entry.
- **2026-07-10 — Round 5: Gemini via Antigravity (guest AI, third
  harness). Nine findings (f.1–f.9); verbatim summary below, with
  Claude/BDFL disposition noted per item.** First non-Claude frontier
  reviewer; inspected `src/mcp/server.ts`, `config.ts`,
  `lib/paths.ts`, and `.claude/agents/` on the branch.
  - **f.1 Granularity — keep Surveyor and Incident Responder
    separate.** Different tempos are different cognitive states
    (routine asset mgmt vs. high-stress strict execution), and merging
    them breaks the Annex B data boundary (Surveyor LAN-only; Incident
    Responder frontier exception). *Disposition: accepted — closes the
    R4 merge question; taxonomy keeps both. Open Questions updated.*
  - **f.2 Triage must stay an agent, not a hook-skill —** and this
    *refutes the proposal's own role/skill/hook criterion.* Running
    Triage as a skill forces the Generalist's hosted-frontier main
    context to ingest raw logs (IP/MAC/token leakage); a scoped
    subagent isolates that high-risk data. *Disposition: accepted —
    strong finding. The decision criterion needs a data-isolation
    override clause; the criterion, not just Triage, is what's wrong.*
  - **f.3 CRITICAL — path traversal in `src/mcp/lib/paths.ts`.**
    `startsWith(REPO_ROOT)` (no trailing separator) admits sibling
    dirs sharing the root name prefix. *Disposition: verified in code
    2026-07-10 and found worse than reported — `fileExists`,
    `getMtime`, `globFiles` have NO containment check at all
    (`getMtime('../../etc/passwd')` escapes today). Filed via bug
    bridge as `issues/bug-mcp-pathsts-prefix-based-containment-check-allows-.md`
    (priority critical, novel — no dedup match across six phrasings);
    GitHub mirror pending (needs network). Per bugs-before-features
    this must be resolved before the Critic pilot ships.*
  - **f.4 Client-multiplexing defeats env isolation.** With stdio
    servers loaded at startup and one client multiplexer, a drifting
    Generalist can invoke tools registered under other roles,
    bypassing `DOCWRIGHT_ROLE`. *Disposition: accepted — hits Annex
    A.2 directly. Confirms why call-time validation (layer 2) cannot
    be optional and must key off server-side role, not client-selected
    tool. Annex A.2 to be hardened; note that the pilot's per-role
    stdio (A.1) partially mitigates only if each role is a separate
    client, which the multiplexer assumption breaks.*
  - **f.5 Argument-level scoping required.** Manifest must scope tool
    *parameters*, not just tool names, or a permitted tool manipulates
    arbitrary files / arbitrary git actions. *Disposition: accepted —
    new Annex A requirement; ties to f.3 (path args are the exploit
    surface).*
  - **f.6 Audit log is not a tamper-proof boundary.** Local
    `audit.jsonl` can be edited; hardening needed if it's a trust
    anchor. *Disposition: accepted as a known limit — A.5 already
    concedes the model stamp is asserted-not-proven; extend A.5 to say
    the audit log is drift-analytics/observability, explicitly not a
    forensic/tamper-evident boundary. Hardening deferred, documented.*
  - **f.7 Triage rebuttal — sanitized egress is feasible (SET
    protocol).** A local regex scrub of common C3/C4 formats (IP,
    base64, hostnames) before egress would permit fast hosted-small
    (Gemini Flash) for routine logs. *Disposition: BDFL call. This is
    the rebuttal the briefing invited on Gemini's own lane. Recorded
    but NOT auto-adopted: the B.2 ruling stands as LAN-only until the
    scrub is proven (recall-of-secrets is the hard part; a regex miss
    is an unlogged leak). Reframed as a follow-up proposal — "prove SET
    scrub recall, then reopen the Triage row" — rather than a ruling
    change. See Open Questions + Future.*
  - **f.8 Temporal incident leases over a standing exception.** A
    standing frontier exception for Incident Responder invites use
    during non-incident states; a leased/expiring token enforces the
    guardrail. *Disposition: accepted as an improvement to the B.3(2)
    ruling — the exception stays option (b) but SHOULD be gated by a
    time-boxed lease tied to an active incident, not a permanent flag.
    B.3 to be annotated; mechanism is a plan-stage detail.*
  - **f.9** (structural/process finding — numbered by Gemini as the
    review-format confirmation) folded into the above.
  - **Net:** one CRITICAL security bug surfaced and filed (f.3),
    Annex A gains three hardening requirements (f.4 multiplexer,
    f.5 arg-scoping, f.6 audit-log honesty), two taxonomy questions
    close (f.1, f.2), and two B.2 rulings get refinements without
    reversal (f.7 → follow-up proposal, not adopted; f.8 → lease the
    Incident exception). The multi-perspective policy paid off: the
    first non-Claude reviewer caught a real vulnerability three
    Claude-family rounds missed.
