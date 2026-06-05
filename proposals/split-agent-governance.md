---
complexity: high
title: Split-Agent Governance — Orchestrator and Code Agent Roles
author: NetYeti
created: 2026-06-05
tags:
  - governance
  - architecture
  - agents
  - security
  - enforcement
  - local-llm
  - model-routing
  - privacy
  - deployment
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/split-agent-governance.md
related_to:
  - plans/phase-1-plan-step-enforcement.md
  - proposals/skill-plan-critique.md
---

## Problem

DocWright's current AI governance model enforces **what** can be mutated but not
**who is allowed to mutate it**. A single AI actor does both governance work (plan
mutations, design decisions, human dialogue) and code work (implementing steps,
running tests). No separation of duty exists.

This single-actor model produced two confirmed behavioral bugs during
`phase-1-plan-step-enforcement` closure:

- **B1** — `update_plan_status` accepted `status: completed` without checking
  `tests_defined: true` or Phase Gate checkbox completion. Mechanical fix (D21)
  addresses this, but the root cause is that one actor controls both the gate and
  the key.
- **B2** — The AI implemented a plan step before design questions posed to the human
  were answered. No mechanical enforcement existed to prevent this. It recurred in
  the same session after being identified.

B2 is the deeper failure: it cannot be fixed by adding validation to a tool,
because it is a decision-sequencing problem at the conversation layer. The only
reliable fix is structural: **separate the actor that asks design questions from
the actor that implements answers.**

Beyond B1/B2, the architecture has a second unresolved problem: **no content
sensitivity model**. Every AI request — whether it touches a strategic proposal or
a unit test — is treated identically and routed to whatever model is configured.
This makes it impossible to guarantee that sensitive governance content (proposals,
policies, plans, design decisions) never leaves a local system, which is a hard
requirement for any compliance-sensitive organization adopting DocWright.

---

## Architecture

```
Human
  │
  │  approvals · design answers · gate sign-offs · tests_defined
  │
  ▼
Orchestrator AI  (always local for Governance/Design content)
  │
  │  1. Classifies request by content sensitivity
  │  2. Calls MCP plan tools (sole write path to plans/ etc.)
  │  3. Poses design questions via AskUserQuestion
  │  4. Dispatches code tasks with content-class tag
  │
  ▼
Meshy / Olla  (routing layer — uniform OpenAI-compatible endpoint)
  │
  │  Routes by: content-class tag × deployment profile
  │  Governance/Design → local LLM (always)
  │  Code/Routine → local or cloud per profile
  │
  ├──→ Local LLMs (Ollama)       ← governance, design, code in full-local/hybrid
  └──→ Cloud API (Anthropic etc) ← code/routine in hybrid/full-cloud only
          │
          ▼
     Code Agent(s)
          │
          │  • Edit/Write/Bash in code dirs only
          │  • No MCP plan tools
          │  • No access to plans/, proposals/, policies/
          │  • Reports results back; does NOT update the plan
          │
          ▼
     Result → Orchestrator validates → updates plan via MCP
```

The orchestrator **cannot** implement code (convention, enforced by hook in Phase 2).
The code agent **cannot** touch governance state (no MCP tools; hook blocks direct
writes). B2 becomes impossible by construction: the actor that asks design questions
cannot implement before receiving answers.

Sensitive governance content **cannot** reach the cloud in `full-local` or `hybrid`
profiles: Meshy enforces the routing rule mechanically before the request leaves the
host.

---

## Content Classification

Before routing or dispatching any AI request, the orchestrator classifies the
content by sensitivity. This classification drives all routing decisions.

| Class | Examples | Default routing |
|-------|----------|-----------------|
| **Governance** | proposals, plans, policies, strategy, org context | Local only — never to cloud |
| **Design** | architecture decisions, technical tradeoffs, threat models | Local only — same class as Governance |
| **Code** | src/, test/, scripts/, config files | Profile-dependent (see Deployment Profiles) |
| **Routine** | status checks, history appends, list operations, file counts | Fastest available — typically tiny local model |

**Classification method:** lightweight rule-set, not ML. In order:

1. **File path patterns** — `plans/`, `proposals/`, `policies/` → Governance;
   `src/`, `test/` → Code; no file context → Routine
2. **Content heuristics** — presence of frontmatter fields (`approved:`,
   `gate_status:`, `assigned_to:`) → Governance; code fences with language tags → Code
3. **Conversation context** — orchestrator maintains a session classification that
   upgrades when sensitive content enters context and never downgrades within a session

**Key invariants:**
- Governance and Design content is classified **before** the request is formed,
  not after. The orchestrator does not assemble a prompt containing governance
  content and then decide where to send it — classification happens first.
- Within a session, if governance content has been loaded into context, the
  **entire session** is treated as governance-class for routing purposes.
- Code agents receive **only** code-class content in their context. Governance
  context is never included in a code agent dispatch.

---

## Deployment Profiles

A deployment profile defines routing behaviour for the entire installation. It is
set once during setup and stored in the DocWright configuration. Agents do not know
which backend they are hitting — Meshy presents a uniform OpenAI-compatible endpoint
regardless of profile.

### `full-local` — Enterprise / Compliance

All computation stays on-premise. No cloud APIs are called. Requires a local GPU
server running Ollama (or compatible).

- Governance + Design + Code + Routine → local LLMs
- Cloud APIs disabled at the Meshy config level (not just the application)
- Suitable for: regulated industries, classified environments, organizations with
  strict data residency requirements
- DocWright ships a reference Meshy config for this profile

### `hybrid` — Standard / Community

Governance and Design content stays local. Code and Routine can go to cloud for
speed or capability, per the routing table.

- Governance / Design → local LLMs (enforced)
- Code → local preferred; cloud fallback if local model lacks tool support
- Routine → smallest capable local model (reduces cloud token usage to near zero
  for operational queries)
- Best for: teams with a local GPU server who want cloud performance for code tasks
- Recommended default for most self-hosted DocWright deployments

### `full-cloud` — Solo Developer / Simple Setup

No local GPU required. All requests go to configured cloud API(s). This is the
easiest deployment but the least private.

- All content classes → cloud API
- **One-time warning at profile setup:** "Governance documents, proposals, plans,
  and policies will be sent to your configured cloud provider. If this is a
  concern, use the `hybrid` or `full-local` profile instead." User accepts once;
  no per-request nagging thereafter.
- Suitable for: individual contributors, open-source projects with no sensitive
  strategy, early evaluation
- DocWright calls the cloud API directly (Meshy optional in this mode)

---

## Role Definitions

### Orchestrator

**Mandate:** Drive the workflow. Own governance state. Classify content. Never
implement directly.

**Capabilities:**
- Classify incoming requests by content sensitivity before any dispatch
- All MCP plan mutation tools — sole write path to `plans/`, `proposals/`, `policies/`
- `AskUserQuestion` — the only channel for posing design questions to the human
- Read access to all repository files (for context and validation)
- Dispatch code tasks to code agents with content-class tag attached

**Prohibitions:**
- No direct `Edit` / `Write` to `src/`, `test/`, `scripts/` — dispatch instead
- No acting on implementation tasks until all design questions are answered and
  recorded (plan Design Decisions, history, or conversation)
- No marking a plan step ✅ Done until the code agent has reported success and
  the result has been validated
- No including governance/design content in a code agent dispatch context

**Dispatch protocol:**
1. Classify the task (content class → routing profile)
2. All design questions answered via `AskUserQuestion`; answers recorded in plan
3. Write a complete, self-contained specification — no ambiguity for the code agent
4. Tag the dispatch with content class
5. Code agent executes and reports results back
6. Orchestrator validates results, then updates plan via MCP

### Code Agent

**Mandate:** Implement what the specification says. Report results. Nothing else.

**Capabilities:**
- `Edit`, `Write`, `Bash` in code directories: `src/`, `test/`, `scripts/`
  (excluding governance scripts — see Prohibitions)
- Run tests and report output
- Receive code-class context only — never sees governance docs

**Prohibitions:**
- No MCP plan mutation tools
- No `Edit` / `Write` to `plans/`, `proposals/`, `policies/`, `docs/SOPs/`,
  `AGENTS.md`, `CLAUDE.md`
- No posing design questions to the human — if the specification is ambiguous,
  report the ambiguity to the orchestrator; do not decide
- No self-directed plan updates of any kind

### Classifier (optional — Tier 2 deployments)

A tiny local model (e.g. qwen2.5:1.5b) that pre-screens requests and adds a
content-class tag before Meshy routing. Eliminates classification latency from
the orchestrator's hot path. Optional — orchestrator handles classification inline
in simple deployments.

### Human

**Mandate:** Provide judgment where AI cannot. Approve. Sign off. Decide.

- Answers design questions via `AskUserQuestion` structured responses
- Sets `tests_defined: true` after reviewing test coverage
- Signs off Phase Gate checklist items
- Approves proposals before downstream changes proceed
- Provides strategy, priority, and judgment under genuine uncertainty

---

## Enforcement Model

### Current (Phase 1 — behavioral + partial mechanical)

| Threat | Enforcement |
|--------|-------------|
| Code agent writes to `plans/` | PreToolUse hook blocks Write/Edit to `plans/*.md` |
| Code agent calls plan MCP tools | Behavioral — code agent not given MCP tools in context |
| Orchestrator implements before design settled | Behavioral — AGENTS.md Invariant |
| Completing plan with pending steps | MCP `update_plan_status` blocks if ⏳ rows remain |
| Completing plan without gate sign-off | MCP `update_plan_status` blocks if `tests_defined: false` or `[ ]` items in Phase Gate |
| Governance content routed to cloud | Behavioral — routing config; no code enforcement yet |

The hook is context-blind at this phase. It blocks bad writes regardless of who is
writing, providing a floor. Role boundary enforcement is behavioral.

### Phase 2 (mechanical role + routing enforcement)

**Role enforcement:**
- `DOCWRIGHT_AGENT_ROLE=orchestrator|code` env var set by orchestrator when spawning agents
- Hook reads `${DOCWRIGHT_AGENT_ROLE:-orchestrator}` on every Write/Edit
- Role `code` → block writes to all governance dirs (not just `plans/`)
- Role `orchestrator` → current behaviour applies

**Routing enforcement:**
- Content classification runs before every dispatch; result logged to audit trail
- Meshy config enforces routing rules independently of application code
- `full-local` and `hybrid` profiles: Meshy rejects cloud API calls for
  Governance/Design content at the proxy level — not just the application level

---

## Meshy / Olla as the Routing Engine

Meshy (growlf/meshy) is a transparent AI inference proxy that presents a single
OpenAI-compatible endpoint to DocWright. Internally it routes requests to local
LLMs (via Ollama) or cloud APIs based on a routing profile.

**Why this matters for DocWright:**

DocWright never needs to know which model handled a request. The same application
code works in `full-local`, `hybrid`, and `full-cloud` deployments — only the
Meshy configuration changes. Model swappability is free: swap a local model version
without touching DocWright.

**Routing table (hybrid profile reference):**

| Content class | Primary backend | Fallback |
|---------------|-----------------|---------|
| Governance | `qwen2.5:14b` (local, Ollama) | `mistral-small3.2:24b` (local) — no cloud fallback |
| Design | `deepseek-r1:14b` (local, reasoning) | `mistral-small3.2:24b` (local) — no cloud fallback |
| Code | `mistral-small3.2:24b` (local, tool-capable) | `claude-haiku` (cloud) |
| Routine | `qwen2.5:1.5b` (local, tiny, fast) | Any available local |

**Meshy as a diagnostic tool:**

If a model produces poor results on a task, the orchestrator re-dispatches to a
different node without losing workflow state. "Try a different node" becomes a
first-class recovery action — model swapping without session restart.

**Deployment without Meshy (full-cloud profile):**

DocWright calls the cloud API directly using the standard OpenAI-compatible client.
Meshy is not required. When the user later wants to add local LLMs, they install
Meshy and switch the endpoint URL — no code change.

**DocWright ships:**
- Reference Meshy config for `full-local` profile
- Reference Meshy config for `hybrid` profile
- Documentation for `full-cloud` (no Meshy config needed)

---

## Human Augmentation Principles

"Augment, not replace" is a design **constraint** enforced by the gate architecture
— not a hope stated in a README.

**What AI does:**
- Drafts proposals, plans, code, and tests
- Searches, classifies, routes, and implements
- Recounts step completions and appends history
- Flags ambiguity and surfaces it to the human (via AskUserQuestion)
- Checks its own work against policy before reporting done

**What humans do:**
- Answer design questions with judgment and context AI cannot have
- Approve proposals before they affect any work
- Sign off Phase Gate checkboxes (attesting that review actually happened)
- Set `tests_defined: true` (attesting that test coverage is adequate)
- Provide strategy, priority, and tiebreaking under genuine uncertainty
- Decide when something is "done enough" vs. when to keep improving

**Enforcement:** The gate architecture makes human input structurally required:
- `update_plan_status("completed")` is blocked mechanically until `tests_defined: true`
  and all Phase Gate `[x]` items are checked
- Proposal approval (`approved: true`) requires `HUMAN_APPROVED=1` env var — the
  human must physically set this; the AI cannot
- `AskUserQuestion` is the only structured channel for design questions — AI uses it
  rather than asking inline and then answering itself

The goal: make human input **easy** (one structured question, one click to answer)
and make **skipping it mechanically hard** (MCP validation, hook enforcement).

---

## Stable Evolution

DocWright governs its own development — this is the reference implementation of
the governance model it ships. Every change to the governance architecture goes
through the same flow the architecture governs: proposal → human approval → plan
→ implementation → tests verified → gate sign-off → completion.

**The enforcement strengthening arc:**

```
Phase 1  →  Behavioral + partial mechanical
Phase 2  →  Hook-enforced role separation + Meshy routing enforcement
Phase 3  →  Formal sandboxing (Claude Code per-agent tool restrictions)
Phase N  →  Continuous improvement via governed proposals
```

Each phase strengthens enforcement without breaking existing rules. Behavioral
contracts become MCP-validated, then hook-enforced, then mechanically sandboxed.
Rules don't get weaker; they get harder to violate.

**Regression protection:**
- Every enforcement rule ships with an automated test that verifies it works
- `tests_defined: true` must be set by a human reviewer before any governance
  enforcement change is marked complete
- CI runs the full test suite on every push — enforcement regressions fail the build

**Versioning:**
- Profiles and routing rules are versioned alongside policies in the git repository
- A routing rule change is a policy change — it goes through the proposal flow
- Adopting organizations inherit the governance model and can propose changes to it
  via the same mechanism

---

## What Changes Per Role

### Orchestrator (this session and beyond)

- Classifies content before dispatch (new responsibility)
- Uses `AskUserQuestion` for all design questions — not inline text
- Dispatches code tasks with content-class tag
- Does not include governance content in code agent context
- Does not write code files directly — dispatches instead
- Validates agent results before calling `update_step`

### Code Agent

- Receives complete, design-resolved specifications with content-class tag
- Operates on code-class content only
- Returns structured result to orchestrator; no plan updates
- Reports ambiguity upward; does not decide

### Human

- Answers design questions via structured `AskUserQuestion` responses
- Reviews and approves proposals before implementation begins
- Signs off gates and tests_defined before plans complete
- Sets pace and priority; AI follows

---

## Deferred to Phase 2

- `DOCWRIGHT_AGENT_ROLE` env-var hook enforcement (mechanical role separation)
- Content classification running before every dispatch (inline in orchestrator for now)
- Meshy reference configs for all three deployment profiles
- Per-profile routing tables (content class → model tier → fallback chain)
- Code agent context template — standardized, governance-knowledge-free
- Classifier model (optional, Tier 2+): tiny local model pre-screening requests
- CI enforcement: verify code agent context cannot trigger plan mutations
- Encryption at rest for governance content (enterprise profile)
- Formal sandboxing when Claude Code exposes per-agent tool restrictions

---

## Related

- `plans/phase-1-plan-step-enforcement.md` — bugs B1, B2 that motivated this proposal
- `AGENTS.md` — behavioral contracts (to be updated after approval)
- `docs/ai-governance-enforcement.md` — five-layer enforcement model (to be updated)
- `docs/governance_enforcement_layers.svg` — architecture diagram (to be updated)
- `docs/SOPs/plan-mutation.md` — plan mutation SOP (orchestrator-only note to be added)
- `policies/core/code-over-memory.md` — the principle this proposal operationalises
- `policies/core/multi-perspective-review.md` — model diversity rationale
- `growlf/meshy` — inference proxy used as routing engine
