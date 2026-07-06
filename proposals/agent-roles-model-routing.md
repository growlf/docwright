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

### B. Per-role model routing

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

### C. Multi-chat, multi-AI research process

Per [[policies/core/multi-perspective-review.md]], refine this proposal by
triangulation before any plan is drafted — a proposal about scoped roles
should itself be reviewed by multiple independent models:

1. **Round 1 — Claude (this thread's lineage):** taxonomy draft (done,
   captured above) + open questions below.
2. **Round 2 — BigPickle (OpenCode's configured LLM):** review the
   taxonomy from the OpenCode-surface perspective — what does its agent
   format support today (per-agent `model:`, permission dialects)?
3. **Round 3 — Gemini (guest AI):** critique role granularity and the
   model-routing matrix; Gemini is a candidate assignee, so it should
   review its own proposed lane.
4. **Round 4 — a local ollama model via ai-stack:** dry-run the Surveyor
   or Triage role prompt on a small local model to test whether the role
   spec is executable at that capability tier — the real feasibility gate
   for the local-model rows in the matrix.
5. **Synthesis:** fold findings back into this proposal (append, don't
   rewrite history); when stable, promote to a plan.

Findings from each round land in the `## Research Log` section appended to
this proposal, dated, with the reviewing model named.

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

- **Granularity:** 7 roles or fewer? Surveyor + Incident Responder may
  merge (same domain, different tempo). Triage may be too thin to be an
  agent vs. a hook-triggered skill.
- **Routing layer:** OpenCode per-agent `model:` vs. meshy-side routing
  vs. both. What happens when the assigned model is unreachable — fallback
  chain per role?
- **Capability floor:** which roles are actually executable on 7–13B
  local models? Needs empirical dry-runs (Round 4), not assumptions.
- **Constitution portability:** exact mechanism for enforcing governance
  boundaries on models that run no client hooks — is dispatch/MCP-side
  validation already complete, or are there gaps (e.g. direct git access)?
- **Cost/telemetry tension:** hosted small models (Gemini) send vault
  content off-LAN. Which roles' data is acceptable to send where? May
  need a per-role data classification.
- **Sync prerequisite:** does [[proposals/deferred-sync-agents-cross-tool.md]]
  need to land first, or can the first new role (Critic) be hand-mirrored
  as a pilot?
- **Routing drift (the failure mode moves up a level):** capability
  scoping fixes in-lane drift but creates a new one — the main session
  doing lifecycle-shaped work itself instead of delegating to the
  Registrar. Trigger/detection heuristics in agent descriptions become
  load-bearing; do they eventually need their own enforcement (e.g. a
  hook that flags role-lane mutations performed outside that role)?
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
- Round-4 dry-run transcripts for local-model roles are attached to the
  Research Log before any local routing is enabled.

## Future

- Bundle the role set as part of DocWright profiles, so adopting
  organizations (Cascade STEAM first) get the roles + routing matrix as a
  governed default — the multi-perspective philosophy transmitted as
  code, not advice.
- Role-level audit stamping: extend `ai-last-action:` to record which
  role (and which model) performed an action.

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
