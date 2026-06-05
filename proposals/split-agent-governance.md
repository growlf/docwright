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
  │  1. Classifies request by content sensitivity (decision tree below)
  │  2. Calls MCP plan tools (sole write path to plans/ etc.)
  │  3. Poses design questions via AskUserQuestion
  │  4. Dispatches code tasks — code-class context only
  │  5. Logs every classification + routing decision to audit trail
  │
  ▼
Meshy / Olla  (routing layer — uniform OpenAI-compatible endpoint)
  │
  │  Routes by: content class × deployment profile config
  │  Governance/Design → local LLM (always, fail-fast if unavailable)
  │  Code/Routine → local or cloud per profile
  │
  ├──→ Local LLMs (Ollama)       ← governance, design, all in full-local/hybrid
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
profiles by virtue of classification + routing. If all local backends for a
Governance-class request are unavailable, the system fails fast — it does not
silently degrade to cloud.

---

## Content Classification

Before routing or dispatching any AI request, the orchestrator classifies the
content by sensitivity. This classification drives all routing decisions and is
logged to the audit trail on every dispatch.

| Class | Examples | Default routing |
|-------|----------|-----------------|
| **Governance** | proposals, plans, policies, strategy, org context | Local only — never to cloud |
| **Design** | architecture decisions, technical tradeoffs, threat models | Local only — same class as Governance |
| **Code** | src/, test/, scripts/, config files | Profile-dependent (see Deployment Profiles) |
| **Routine** | status checks, history appends, list operations, file counts | Fastest available local model |

### Classification Decision Tree

Priority order — higher rules override lower:

1. **Conversation context (highest priority)** — if governance or design content has
   entered the orchestrator's context at any point this session, the **entire session**
   is Governance class. This never downgrades within a session.

2. **File path patterns** — `plans/`, `proposals/`, `policies/` → Governance;
   `src/`, `test/`, `scripts/` → Code; no file context → Routine.

3. **Content heuristics (tiebreaker)** — frontmatter fields (`approved:`,
   `gate_status:`, `assigned_to:`) → Governance; code fences with language
   tags → Code.

**Edge case — mixed-context tasks:** "Read this proposal and write a unit test for
it." The moment the proposal loads into the orchestrator's context, the session
becomes Governance class. The test-writing sub-task is dispatched as a **new
code-agent invocation** with only the test specification in its context — no
proposal content. The orchestrator writes the specification; the code agent sees
only Code-class material.

**Key invariants:**
- Classification happens **before** the prompt is assembled. The orchestrator does
  not form a prompt containing governance content and then decide where to send it.
- Governance and Design content is **never** included in a code agent dispatch
  context, regardless of profile.
- When in doubt, classify up (Governance > Design > Code > Routine).

### Secrets — Absolute Routing Override

Secret-bearing content — credentials, API keys, private keys, tokens, passwords,
connection strings, PII — is subject to a routing restriction that **overrides
all other classification decisions, profile settings, and `cloud_allowed_for`
configuration**: secrets never reach an external node. Ever.

This rule has no exceptions, no waivers, and no profile that enables it.
`cloud_allowed_for: ["Governance"]` does not override it. Individual acceptance
does not override it. It is a hard invariant of the architecture.

**What counts as secret-bearing:** content containing or referencing credentials,
authentication tokens, private keys, connection strings with embedded passwords,
PII, or any data whose exposure would constitute a security or legal breach. When
in doubt, treat as secret.

**"External" vs "internal" nodes:** not all remote nodes are cloud. An
organization's own Meshy instance accessed over VPN is an internal node — data
stays within the trust boundary. A public cloud API (Anthropic, OpenAI, etc.) is
an external node regardless of contractual privacy terms. The distinction is
organizational trust boundary, not network topology. See Node Trust Classification
in the Meshy section below.

**Detection — defense-in-depth (no single layer is sufficient):**

1. **Architectural** — secrets must not appear in governance documents at all.
   Store in a secrets manager and reference by name only. Secrets that never
   enter documents cannot leak through routing. DocWright should integrate with
   common secrets managers as a first-class feature — see deferred proposal below.
2. **Pre-commit** — existing `no-secrets.md` hook rejects staged secrets before
   they reach the repository.
3. **Orchestrator behavioral** — never include secret-bearing content in any
   dispatch to an external node. Phase 1 enforcement.
4. **Pattern matching** — known secret formats (PEM blocks, bearer tokens,
   `password:` fields, `-----BEGIN * KEY-----`) detected as a secondary check.
   Catches common formats; not exhaustive.
5. **Meshy proxy enforcement** — external nodes refuse prompts containing detected
   secret patterns. Phase 2 cross-project requirement (see Meshy section).

No detection method is complete for arbitrary text. The primary mitigation is
architectural: layer 1 ensures secrets are not in documents in the first place.

---

## Deployment Profiles

A deployment profile is a **named reference configuration** — a Meshy routing
config file, not a hardcoded application state. Organizations can define custom
profiles beyond the three shipped defaults.

The three profiles below are documentation shorthand for common configurations.
**Enforcement is not based on profile names** — it is based on `cloud_allowed_for`
in `opencode.json`, which declares a per-content-class ceiling on what the
org permits to be routed to cloud (see Org Policy and Individual Acceptance below).

Agents do not know which backend they are hitting — Meshy presents a uniform
OpenAI-compatible endpoint regardless of profile.

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

- Governance / Design → local LLMs; fail fast if unavailable (no cloud fallback)
- Code → local preferred; cloud fallback if local model lacks tool support
- Routine → smallest capable local model (reduces cloud token usage to near zero
  for operational queries)
- Best for: teams with a local GPU server who want cloud performance for code tasks
- Recommended default for most self-hosted DocWright deployments

### `full-cloud` — Solo Developer / Simple Setup

No local GPU required. All requests go to configured cloud API(s). This is the
easiest deployment but the least private.

- All content classes → cloud API
- Equivalent to `"cloud_allowed_for": ["Code", "Routine", "Design", "Governance"]`
  in `opencode.json`; per-machine acceptance required for all classes (see
  Org Policy and Individual Acceptance below)
- Suitable for: individual contributors, open-source projects with no sensitive
  strategy, early evaluation
- DocWright calls the cloud API directly (Meshy optional in this mode)

### Org Policy and Individual Acceptance

The profile names above are shorthand. The actual enforcement is a two-field
ceiling-and-acknowledgment pair.

**`cloud_allowed_for` — org/project policy (`opencode.json`, committed to git):**

```json
"deployment": {
  "cloud_allowed_for": ["Code", "Routine"]
}
```

Declares which content classes the organization permits to be routed to cloud APIs.
This is the **ceiling** — no individual can send a content class to cloud that is
not in this list, regardless of their local config or personal acceptance.

| `cloud_allowed_for` value | Profile equivalent | Typical use case |
|---------------------------|--------------------|-----------------|
| `[]` or field absent | `full-local` | Regulated org; nothing leaves the building |
| `["Code", "Routine"]` | `hybrid` | Team with local GPU; governance always local |
| `["Code", "Routine", "Design", "Governance"]` | `full-cloud` | Solo dev; OSS contributor without GPU |

**`cloud_accepted_for` — per-machine acknowledgment (`.docwright/config.json`, gitignored):**

```json
{
  "cloud_accepted_for": ["Code", "Routine"],
  "accepted_at": "2026-06-05T..."
}
```

Each person must explicitly acknowledge the content classes they are routing to
cloud on their machine. This file is gitignored — acceptance is a per-person,
per-checkout decision, not a repo decision. A fresh clone has no acceptance record
and will prompt before routing anything to cloud.

**Session-start enforcement:**

1. Read `cloud_allowed_for` from `opencode.json` → the org ceiling
2. Read `cloud_accepted_for` from `.docwright/config.json` → per-machine acceptance
3. If any routing decision would send a class to cloud that is not in
   `cloud_allowed_for`: **hard error** — org policy ceiling violated; no bypass;
   logged to audit trail
4. If `cloud_allowed_for` permits a class but the individual has not yet accepted
   it: **prompt for acceptance**, write accepted class to `.docwright/config.json`,
   log to audit trail
5. Individual acceptance of a class not in `cloud_allowed_for` is silently ignored
   — the ceiling takes precedence

**Why this design handles both enterprise and open-source:**

An enterprise org sets `"cloud_allowed_for": []` in the committed `opencode.json`.
No individual can override this — there is no path to cloud regardless of what they
put in their local config. An open-source project sets `"cloud_allowed_for":
["Code", "Routine", "Design", "Governance"]` — fully permissive. Each contributor
accepts whichever classes match their local setup. The governance model scales
from one person on a laptop to a compliance team in a regulated environment without
any code change — only the `cloud_allowed_for` list changes.

---

## Role Definitions

### Orchestrator

**Mandate:** Drive the workflow. Own governance state. Classify content. Never
implement directly.

**Capabilities:**
- Classify incoming requests by content sensitivity (decision tree above)
- All MCP plan mutation tools — sole write path to `plans/`, `proposals/`, `policies/`
- `AskUserQuestion` — the only channel for posing design questions to the human
- Read access to all repository files (for context and validation)
- Dispatch code tasks — code-class context only included in the dispatch

**Prohibitions:**
- No direct `Edit` / `Write` to `src/`, `test/`, `scripts/` — dispatch instead
- No acting on implementation tasks until all design questions are answered and
  recorded (plan Design Decisions, history, or conversation)
- No marking a plan step ✅ Done until the code agent has reported success and
  the result has been validated
- No including governance/design content in a code agent dispatch context

**Dispatch protocol:**
1. Classify the task (decision tree → content class)
2. All design questions answered via `AskUserQuestion`; answers recorded in plan
3. Write a complete, self-contained specification containing only code-class context
4. Log the dispatch (classification, destination, model) to audit trail
5. Invoke the code agent (see Dispatch Mechanism below)
6. Receive result; validate; update plan via MCP

**Dispatch mechanism — concrete:**
- **Claude Code:** use the `Agent` tool. The `prompt` parameter contains only the
  code-class specification — no governance docs, no proposal content. The agent
  receives only what the orchestrator explicitly puts in the prompt.
- **OpenCode:** start a `mode` session (e.g. `docwright-assist`) with a prompt
  containing only the code-class specification. Governance context from the
  orchestrator's session is not inherited.
- The "content-class tag" is not a literal field — it is enforced by what context
  the orchestrator chooses to include. Governance content is kept out of the
  dispatch prompt by the orchestrator's discipline (Phase 1) and by context
  template enforcement (Phase 2).

**Known Phase 1 limitation:** if the orchestrator misclassifies content and
includes governance material in a code agent dispatch prompt, the hook still
blocks the code agent from writing plan files — but content leakage to cloud is
not mechanically prevented. The routing audit trail makes this detectable after
the fact. Phase 2 env-var enforcement reduces this risk by making the role
boundary explicit.

### Code Agent

**Mandate:** Implement what the specification says. Report results. Nothing else.

**Capabilities:**
- `Edit`, `Write`, `Bash` in code directories: `src/`, `test/`, `scripts/`
  (excluding governance scripts — see Prohibitions)
- Run tests and report output
- Receives code-class context only — never sees governance docs

**Prohibitions:**
- No MCP plan mutation tools
- No `Edit` / `Write` to `plans/`, `proposals/`, `policies/`, `docs/SOPs/`,
  `AGENTS.md`, `CLAUDE.md`
- No posing design questions to the human — if the specification is ambiguous,
  return the ambiguity to the orchestrator; do not decide
- No self-directed plan updates of any kind

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
| Governance content routed to cloud | Classification + routing; `cloud_allowed_for` org ceiling checked at session start; hard error if class not permitted; misclassification detectable via audit trail |
| Cloud class permitted but not individually accepted | Prompt at session start; write `cloud_accepted_for` to `.docwright/config.json`; log to audit trail |
| Individual attempts to exceed org ceiling | Hard error — `cloud_allowed_for` takes precedence over local acceptance record; no bypass |
| Secret-bearing content dispatched to external node | Hard error — secrets absolute override; no profile, acceptance flag, or `cloud_allowed_for` setting permits this; audit trail entry; no bypass |

The hook is context-blind at this phase. It blocks bad writes regardless of who is
writing, providing a floor. Role boundary enforcement is behavioral; the audit trail
makes violations detectable.

### Phase 2 — Hook-enforced role separation

- `DOCWRIGHT_AGENT_ROLE=orchestrator|code` env var set by orchestrator when
  spawning agents
- Hook reads `${DOCWRIGHT_AGENT_ROLE:-orchestrator}` on every Write/Edit
- Role `code` → block writes to all governance dirs (not just `plans/`)
- Role `orchestrator` → current behaviour applies

This makes role boundary enforcement mechanical rather than behavioral. A code
agent running with `DOCWRIGHT_AGENT_ROLE=code` cannot write to governance dirs
regardless of what it attempts.

Routing enforcement at the Meshy proxy level (rejecting Governance→cloud requests
at the HTTP layer) is **optional defense-in-depth** — not a Phase 2 requirement.
Classification + routing config is the primary enforcement gate; proxy-level
rejection is a secondary backstop if desired.

### Phase 3 — Optional hardening

- Proxy-level enforcement in Meshy (reject Governance→cloud at HTTP layer)
- Formal per-agent tool restrictions if Claude Code ever exposes this capability

**Note:** Phase 3 items are optional hardening, not required milestones. The system
is fully operational and secure at Phase 2. If Claude Code never adds formal
per-agent tool restrictions, the hook + env-var approach from Phase 2 is the
sufficient final enforcement state.

---

## Routing Audit Trail

Every classification decision and routing decision is logged to
`.docwright/audit.jsonl` (the existing audit log used for MCP mutations). This is
a **Phase 1 requirement**, not a Phase 2 addition — it is the primary mechanism
for detecting misclassification in the absence of mechanical enforcement.

Each entry records:
- Timestamp
- Content class assigned (Governance / Design / Code / Routine)
- Rule that triggered the classification (context / path / heuristic)
- Routing destination (local model name, or cloud provider)
- Session ID

This makes "governance content went to cloud" a detectable event, not just a
theoretical risk. Compliance audit reviews the log, not the AI's memory.

---

## Meshy / Olla as the Routing Engine

Meshy (growlf/meshy) is a transparent AI inference proxy that presents a single
OpenAI-compatible endpoint to DocWright. Internally it routes requests to local
LLMs (via Ollama) or cloud APIs based on a routing profile config file.

**Why this matters for DocWright:**

DocWright never needs to know which model handled a request. The same application
code works across all deployment profiles — only the Meshy configuration changes.
Model swappability is free: update a local model without touching DocWright.

**Routing table (hybrid profile reference):**

| Content class | Primary backend | Fallback |
|---------------|-----------------|---------|
| Governance | `qwen2.5:14b` (local) | `mistral-small3.2:24b` (local) — **no cloud fallback** |
| Design | `deepseek-r1:14b` (local, reasoning) | `mistral-small3.2:24b` (local) — **no cloud fallback** |
| Code | `mistral-small3.2:24b` (local, tool-capable) | `claude-haiku` (cloud) |
| Routine | `qwen2.5:1.5b` (local, tiny, fast) | Any available local |

**Failure SOPs:**

| Failure | Behaviour |
|---------|-----------|
| Governance/Design LLMs all down | **Fail fast** — error returned, ask human to restore local LLM. Never degrade to cloud. |
| Meshy unreachable | **Fail fast** — no silent cloud fallback. Error surfaces to orchestrator. |
| Code-class local LLM down, cloud fallback available | Use cloud fallback per routing table |
| Code-class LLM down, no fallback, hybrid profile | Error — ask human or switch profile |
| full-cloud API rate-limited | Standard retry/backoff; no special handling |

The invariant: **Governance and Design class never fall back to cloud**, regardless
of profile, unless `full-cloud` was explicitly chosen and the acceptance record is
present in config.

### Node Trust Classification

Not all remote Meshy nodes are "cloud." An organization may operate nodes that
are remote — accessed over VPN, a private network, or an internal domain — but
remain within the organizational trust boundary. These are **internal** nodes.
Public cloud API endpoints are **external** nodes regardless of any contractual
privacy guarantees. The distinction is organizational trust boundary, not network
topology or latency.

This classification is required because the secrets absolute override (above)
depends on knowing which nodes are safe recipients. Every Meshy routing config
must tag each node with a trust level:

```yaml
nodes:
  - id: local-ollama
    endpoint: http://localhost:11434
    trust: internal          # local — trivially within boundary
  - id: company-meshy
    endpoint: https://meshy.company.internal
    trust: internal          # remote but within org boundary
  - id: anthropic-cloud
    endpoint: https://api.anthropic.com
    trust: external          # outside org boundary — secrets never routed here
  - id: openai
    endpoint: https://api.openai.com
    trust: external
```

The reference Meshy configs DocWright ships (`configs/meshy/full-local.yaml`,
`configs/meshy/hybrid.yaml`) include trust tags for all nodes. Organizations
adding custom nodes must tag them explicitly — untagged nodes default to
`trust: external` (fail-safe).

**This is a cross-project requirement.** DocWright defines the policy and
configuration contract; the Meshy project must implement:
- The `trust` field on node definitions
- Routing enforcement: reject requests to `trust: external` nodes when the
  content contains detected secret patterns (Phase 2)
- A hard block for content classes restricted from cloud by `cloud_allowed_for`

Phase 1: orchestrator behavioral enforcement — never dispatch secrets or
restricted content to external nodes. Phase 2: Meshy proxy enforcement at the
HTTP layer, removing dependence on orchestrator discipline.

**Meshy as a diagnostic tool:**

If a model produces poor results, the orchestrator re-dispatches to a different
node without losing workflow state. Model swapping becomes a first-class recovery
action rather than a session restart.

**Deployment without Meshy (full-cloud profile):**

DocWright calls the cloud API directly. Meshy is not required. When the user later
wants to add local LLMs, they install Meshy and switch the endpoint URL — no code
change in DocWright.

**DocWright ships:**
- `configs/meshy/full-local.yaml` — reference Meshy routing config for `full-local` profile
- `configs/meshy/hybrid.yaml` — reference Meshy routing config for `hybrid` profile
- Documentation for `full-cloud` (no Meshy config needed)

---

## Human Augmentation Principles

"Augment, not replace" is a design **constraint** enforced by the gate architecture
— not a hope stated in a README.

**What AI does:**
- Drafts proposals, plans, code, and tests
- Searches, classifies, routes, and implements
- Recounts step completions and appends history
- Critiques proposals, plans, tests, and process for gaps, security issues, and
  logical fallacies — systematically and at a speed no human reviewer can match
- Flags ambiguity and surfaces it to the human (via AskUserQuestion)
- Checks its own work against policy before reporting done

**What humans do:**
- Originate proposals, ideas, and raw creative direction — the wellspring of
  what gets built; AI drafts and refines, but humans conceive
- Bring imagination, creativity, and critical thought throughout: challenge AI
  conclusions, question assumptions, envision what doesn't yet exist
- Maintain strategic oversight and direction — set priorities, redirect work,
  decide what matters and what doesn't
- Critique proposals, plans, tests, and process with lived experience,
  organizational context, and intuition about what actually matters
- Answer design questions with judgment and context AI cannot have
- Approve proposals before they affect any work
- Sign off Phase Gate checkboxes (attesting that review actually happened)
- Set `tests_defined: true` (attesting that test coverage is adequate)
- Decide when something is "done enough" vs. when to keep improving

**The review duality:** Both humans and AI critique — but differently. AI scans
systematically, quickly, and without fatigue; humans bring experience, intuition,
and awareness of organizational context that no model has. Neither catches
everything the other does. Running both perspectives is what
`policies/core/multi-perspective-review.md` formalizes: DocWright itself was
built by triangulating between Claude, BigPickle, and NetYeti — each catching
what the others missed. Every adopting organization inherits this practice.

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
Phase 1  →  Behavioral + partial mechanical + routing audit trail
Phase 2  →  Hook-enforced role separation (DOCWRIGHT_AGENT_ROLE)
Phase 3  →  Optional: proxy-level Meshy enforcement; Claude Code sandboxing
Phase N  →  Continuous improvement via governed proposals
```

Each phase strengthens enforcement without breaking existing rules. Behavioral
contracts become MCP-validated, then hook-enforced. Phase 3 items are hardening,
not required milestones — the system is fully operational at Phase 2.

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

- Classifies content before dispatch using the decision tree
- Uses `AskUserQuestion` for all design questions — not inline text
- Dispatches code tasks with code-class-only context
- Logs every classification and routing decision to audit trail
- Does not include governance content in code agent context
- Does not write code files directly — dispatches instead
- Validates agent results before calling `update_step`

### Code Agent

- Receives complete, design-resolved specifications with code-class context only
- Reports ambiguity upward; does not decide
- Returns result to orchestrator; no plan updates

### Human

- Answers design questions via structured `AskUserQuestion` responses
- Reviews and approves proposals before implementation begins
- Signs off gates and tests_defined before plans complete
- Sets pace and priority; AI follows

---

## Phase 1 Implementation (after approval)

These are the only changes required immediately after approval. No new code,
no web UI changes, no MCP server changes, no test suite changes.

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Add Orchestrator / Code Agent role definitions and classification decision tree | `AGENTS.md` |
| 2 | Update enforcement model for two-actor architecture | `docs/ai-governance-enforcement.md` |
| 3 | Add orchestrator-only preamble to plan mutation SOP | `docs/SOPs/plan-mutation.md` |
| 4 | Rework enforcement layers diagram | `docs/governance_enforcement_layers.svg` |
| 5 | Extend orchestrator behavior to log classification/routing decisions to `.docwright/audit.jsonl` | Behavioral (Phase 1); dispatch module (Phase 2) |
| 6 | Add `deployment.cloud_allowed_for` to `opencode.json`; implement session-start ceiling check and per-machine acceptance prompt writing to `.docwright/config.json` | `opencode.json` + `.docwright/config.json` |
| 7 | Update `opencode.json` orchestrator instructions with classification discipline note | `opencode.json` |

**What this proposal does NOT change:** the MCP server, the existing
enforcement hooks, the web UI, the test suites, the git pre-commit gate,
the profile system, or the document lifecycle. All Phase 1 enforcement
infrastructure remains unchanged and is the foundation Phase 2 builds on.

---

## Deferred to Phase 2

- `DOCWRIGHT_AGENT_ROLE` env-var hook enforcement (mechanical role separation)
- Code agent context template — standardized, governance-knowledge-free
- CI enforcement: verify code agent context cannot trigger plan mutations
- Encryption at rest for governance content (enterprise profile)
- **Meshy node trust tagging** — implement `trust: internal|external` on node
  definitions; proxy-layer enforcement rejecting secret-bearing content and
  `cloud_allowed_for`-restricted classes from reaching `trust: external` nodes
  at the HTTP layer. Cross-project requirement: changes needed in the Meshy
  project as well as DocWright's reference routing configs.

**Deferred proposal — secrets manager integration:** DocWright should natively
support referencing secrets from a password/secrets manager rather than embedding
them in documents. Candidate integrations: Bitwarden / Vaultwarden (self-hosted,
open-source — preferred for FOSS alignment), 1Password (teams), HashiCorp Vault
(enterprise). The pattern: documents reference `{{secret:my-api-key}}` and
DocWright resolves the value at use time from the configured manager — the
document itself never contains the plaintext. Capture as a standalone proposal
before Phase 2 planning begins.

## Deferred to Phase 3 (optional hardening)

- Proxy-level Meshy enforcement — reject Governance→cloud at HTTP layer
- Formal per-agent tool restrictions (if Claude Code ever exposes this)

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
