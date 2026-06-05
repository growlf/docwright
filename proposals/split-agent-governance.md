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
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/split-agent-governance.md
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
  addresses this partially, but the root cause is that one actor controls both
  the gate and the key.
- **B2** — The AI implemented a plan step (added D21 to the Implementation Steps
  table) before design questions posed to the human were answered. No mechanical
  enforcement existed to prevent this. It recurred in the same session after being
  identified.

B2 is the deeper failure: it cannot be fixed by adding validation to a tool,
because it is a decision-sequencing problem at the conversation layer. The AI
asked a question, then answered it itself by acting. No hook fires on "acting
before receiving an answer."

The only reliable fix is structural: **separate the actor that asks design
questions from the actor that implements answers.**

---

## Architecture

```
Human
  │
  │  approvals · design answers · tests_defined sign-off
  │
  ▼
Orchestrator AI  (cloud model — Claude, GPT-4, etc.)
  │
  │  • MCP plan tools (sole write path to plans/, proposals/, policies/)
  │  • AskUserQuestion (sole design-question channel)
  │  • Read-only access to code (for context, not mutation)
  │  • Dispatches code tasks with complete specifications
  │
  ▼
Code Agent(s)  (local LLM preferred — Ollama/Meshy)
  │
  │  • Edit / Write / Bash in code directories only
  │  • No MCP plan tools
  │  • No access to plans/, proposals/, policies/
  │  • Reports results back; does NOT update the plan
  │
  ▼
Result returned to Orchestrator → validates → updates plan via MCP
```

The orchestrator **cannot** implement code (by convention and eventually by hook
enforcement). The code agent **cannot** touch governance state (no MCP tools;
hook blocks direct writes). B2 becomes impossible by construction: the actor
that asks design questions is physically separated from the actor that writes code.

---

## Role Definitions

### Orchestrator

**Mandate:** Drive the workflow. Own governance state. Never implement directly.

**Capabilities:**
- All MCP plan mutation tools (`update_step`, `update_plan_status`, `append_history`,
  `set_plan_field`, `write_plan`, `transition_to_completed`)
- `AskUserQuestion` — the only channel for posing design questions to the human
- Read access to all repository files (for context and validation)
- Dispatch code agents with complete, design-answered specifications

**Prohibitions:**
- No direct `Edit` / `Write` to `src/`, `test/`, `scripts/` (code dirs)
- No acting on implementation tasks until all design questions for that task
  are answered and recorded in the plan or conversation
- No marking a plan step ✅ Done until the code agent has reported success
  and the result has been validated

**Dispatch protocol:**
1. All design questions for the task are answered (via `AskUserQuestion`)
2. Answers are recorded (plan Design Decisions, history, or inline)
3. A complete specification is written — the code agent receives a self-contained
   brief, not a question
4. Code agent executes and reports results
5. Orchestrator validates results, then updates plan via MCP

### Code Agent

**Mandate:** Implement what the specification says. Report results. Nothing else.

**Capabilities:**
- `Edit`, `Write`, `Bash` in code directories: `src/`, `test/`, `scripts/`
  (excluding governance scripts — see Prohibitions)
- Run tests and report output
- Read governance docs for context if explicitly provided by orchestrator

**Prohibitions:**
- No MCP plan mutation tools
- No `Edit` / `Write` to `plans/`, `proposals/`, `policies/`, `docs/SOPs/`,
  `AGENTS.md`, `CLAUDE.md`
- No posing design questions to the human — if the specification is ambiguous,
  report the ambiguity back to the orchestrator; do not make design decisions
- No self-directed plan updates (cannot call `update_step` even if it could)

---

## Enforcement Model

### Current (Phase 1 — behavioral + partial mechanical)

| Threat | Enforcement |
|--------|-------------|
| Code agent writes to plans/ | PreToolUse hook blocks Write/Edit to `plans/*.md` |
| Code agent calls plan MCP tools | Behavioral only — code agent is not given MCP tools in its context |
| Orchestrator implements before design settled | Behavioral only — AGENTS.md Invariant |
| Orchestrator marks step done without validation | MCP `update_plan_status` blocks `completed` if ⏳ rows remain |

The hook is **context-blind** at this phase. It blocks bad writes regardless of
who is writing, which provides a floor. But it cannot distinguish orchestrator
from code agent, so it cannot enforce role boundaries mechanically.

### Phase 2 (mechanical role enforcement)

Add `DOCWRIGHT_AGENT_ROLE` environment variable awareness to the hook:

- Orchestrator spawns code agents with `DOCWRIGHT_AGENT_ROLE=code` set
- Hook reads `${DOCWRIGHT_AGENT_ROLE:-orchestrator}` on every Write/Edit
- If role is `code`, block writes to all governance dirs (not just `plans/`)
- If role is `orchestrator` or unset, current behaviour applies

This makes role separation mechanical, not behavioral. A code agent running
with `DOCWRIGHT_AGENT_ROLE=code` cannot write to governance dirs regardless
of what it attempts.

---

## Local LLMs for Code Agents

Because code agents operate on code only — no governance docs, no proposals,
no business strategy or org context — they carry **no sensitive information**.
This makes them safe to run on local LLMs via Ollama or the Meshy inference
proxy, rather than cloud APIs.

Benefits:
- **Cost** — cloud token usage drops significantly; only the orchestrator (which
  handles reasoning, design, and governance) requires a capable cloud model
- **Security surface** — sensitive org context (proposals, policies, strategy)
  never leaves the local network; code agents see only code
- **Latency** — local models respond faster for routine edits; cloud model
  reserved for decisions that need it
- **Privacy** — proprietary code sent to a local model, not an external API

DocWright's existing Meshy inference proxy (`growlf/meshy`) is already
positioned as the routing layer for this. Code agent dispatches go to
`meshy → local LLM`; orchestrator calls go to `meshy → cloud model`.

---

## Model Routing and Swappability

The orchestrator selects which model handles each dispatch. This is model
routing at the workflow layer rather than at the API layer.

**Practical routing policy (starting point):**

| Task type | Suggested model tier |
|-----------|---------------------|
| Routine code edits, test fixes | Fast local LLM (Ollama) |
| Complex algorithm / architecture | Mid-tier cloud or strong local |
| Governance decisions, design questions | Cloud model (orchestrator) |
| Security-sensitive changes | Cloud model with explicit review |

**Swappability as a diagnostic tool:**

In the single-actor model, "this model is stuck" means restarting the session.
In the split-agent model, the orchestrator can re-dispatch to a different node
without losing workflow state. If a code agent produces poor output, the
orchestrator discards the result, adjusts the specification, and dispatches
again — to the same node or a different one. The plan state is unchanged until
the orchestrator validates and updates it.

This was identified as a gap during `phase-1-plan-step-enforcement` development:
switching between Claude and BigPickle (OpenCode) helped catch issues each model
missed, but required manual session management. Routing makes this systematic.

---

## What Changes Per Role

### Orchestrator (Claude Code main session)

- Continues using MCP tools as the sole plan mutation path
- Adds explicit dispatch step before any code implementation
- Uses `AskUserQuestion` for all design questions (structured, not inline text)
- Does not use `Edit` / `Write` on code files — dispatches instead
- Validates agent results before calling `update_step`

### Code Agent (subagent or OpenCode session)

- Receives a complete, design-resolved specification — no ambiguity
- Writes code, runs tests, returns structured result
- Does not call plan tools or update governance state
- If specification is ambiguous: reports ambiguity, does not decide

### Human (NetYeti)

- Answers design questions via `AskUserQuestion` responses
- Sets `tests_defined: true` after reviewing test coverage
- Signs off Phase Gate items
- Approves proposals before downstream changes proceed

---

## Deferred to Phase 2

- `DOCWRIGHT_AGENT_ROLE` env-var hook enforcement (mechanical role separation)
- Code agent template: standardized prompt context excluding plan knowledge
- Model routing config in `profile.json`: per-task model selection
- Meshy integration: transparent local LLM dispatch from orchestrator
- CI enforcement: verify code agents cannot reach plan mutation tools
- Formal sandboxing when Claude Code exposes per-agent tool restrictions

---

## Related

- `plans/phase-1-plan-step-enforcement.md` — bugs B1, B2 that motivated this proposal
- `AGENTS.md` — behavioral contracts (to be updated after approval)
- `docs/ai-governance-enforcement.md` — five-layer enforcement model (to be updated)
- `docs/governance_enforcement_layers.svg` — architecture diagram (to be updated)
- `docs/SOPs/plan-mutation.md` — plan mutation SOP (to be updated)
- `policies/core/code-over-memory.md` — the principle this proposal operationalises
- `policies/core/multi-perspective-review.md` — model diversity rationale
