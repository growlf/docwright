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
priority: 3
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
   f.1; Round 3 f.2/f.3).
2. **Routing-drift countermeasure is specified** — how main-session work
   gets routed to roles instead of done in place, with named detection
   heuristics (Round 2 f.1).
3. **Data classification is decided** — which roles' data may be sent to
   which endpoints (hosted vs. LAN); gates every hosted-small-model
   routing row (Round 2 f.5).
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

## Future

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
