---
title: "Plan Execution Mode — Naming Recommendation"
status: concluded
question: "What should the 'automated' field and its values be called to accurately reflect their intent?"
conclusion: recommends
author: NetYeti
created: 2026-06-08
author-role: contributor
tags:
  - research
  - plan-modes
  - naming
  - ux
linked_proposals:
  - proposals/approved/research-plan-execution-modes.md
related_research:
  - research/plan-execution-mode-tool-survey.md
---

# Plan Execution Mode — Naming Recommendation

## Questions Explored

- What should the `automated` field be renamed to?
- What should the values `off | guided | full` be renamed to?
- Which naming set best communicates intent, supports a positive default, and avoids false implications?

## Approaches Compared

### Candidate Set A — `mode: mentor | guided | autonomous`

| Value | Replaces | Meaning |
|-------|---------|---------|
| `mentor` | `off` | AI advises and suggests; human decides and executes every step |
| `guided` | `guided` | Human directs; AI drafts on request and reviews work |
| `autonomous` | `full` | AI executes; human approves at governance gates only |

**Field rename:** `automated` → `mode`

Pros:
- `mentor` is positive and intentional — eliminates "disabled" connotation of `off`
- `autonomous` is the correct technical term for AI-led execution (consistent with industry)
- `guided` stays — low migration cost, already understood
- `mode` as field name clearly signals "this is a named way of working", not a quantity
- All three values are verb-like nouns that describe a relationship, not a dial setting

Cons:
- `mentor` is not widely used in AI tools (see [[research/plan-execution-mode-tool-survey.md]]) — may need documentation to land
- Three-word set doesn't map to a simple "low/medium/high" mental model

---

### Candidate Set B — `mode: human-led | collaborative | ai-led`

| Value | Replaces | Meaning |
|-------|---------|---------|
| `human-led` | `off` | Human drives all execution |
| `collaborative` | `guided` | Shared execution, AI assists |
| `ai-led` | `full` | AI drives execution |

**Field rename:** `automated` → `mode`

Pros:
- Crystal-clear intent — no ambiguity about who leads
- `human-led` is explicitly positive (not "off")
- `ai-led` is accurate

Cons:
- Hyphenated values are awkward in YAML and dropdown selects
- `ai-led` sounds risky in a governance-first system — may discourage adoption
- `collaborative` is generic — sounds like all three modes are collaborative
- No industry precedent for this framing

---

### Candidate Set C — `mode: mentor | assisted | agentic`

| Value | Replaces | Meaning |
|-------|---------|---------|
| `mentor` | `off` | AI in pure advisory role |
| `assisted` | `guided` | Human executes with AI assistance on request |
| `agentic` | `full` | AI operates as an autonomous agent |

**Field rename:** `automated` → `mode`

Pros:
- `agentic` aligns with emerging industry terminology (Cursor, OpenCode agent mode)
- `mentor` retains the positive reframe
- `assisted` is clear

Cons:
- `assisted` and `agentic` both overlap in casual reading ("isn't all AI use 'assisted'?")
- `agentic` is jargon — acceptable for developers, poor for non-technical governance users
- Low consistency with existing `guided` usage in deployed plans

---

## Findings

### The field rename (`automated` → `mode`) is unambiguous

`automated` implies a quantity — "how much automation is present." `mode` implies a named configuration — "which way of working are we using." Every candidate set uses `mode` as the field name. This rename is a clear improvement regardless of value naming.

### The `off` → `mentor` rename is the highest-value change

The core problem is that `off` describes the absence of something, while the intent is a positive, deliberate choice to have the human lead. `mentor` communicates:
- The AI is present and active (not off)
- The AI's role is to advise and improve, not to execute
- The human is the practitioner, the AI is the guide

This framing is consistent with DocWright's governance philosophy: humans are always accountable, AI is always bounded.

### `guided` should stay

`guided` accurately describes the middle mode (human directs, AI drafts on request) and is already used in ~30 deployed plans. Changing it adds migration cost with minimal naming benefit. It lands between `mentor` (pure advisory) and `autonomous` (AI-led) in a natural gradient.

### `full` → `autonomous` is correct

`full` suggests "full automation" without specificity. `autonomous` is the industry-standard term for AI acting on its own with tool use. It is more precise, less ambiguous, and widely understood by the target audience (developers and governance practitioners).

## Recommendation

**Use Candidate Set A: `mode: mentor | guided | autonomous`**

Migration mapping:
| Old | New | Notes |
|-----|-----|-------|
| `automated: off` | `mode: mentor` | Pure field rename + value rename |
| `automated: guided` | `mode: guided` | Field rename only; value unchanged |
| `automated: full` | `mode: autonomous` | Field rename + value rename |

**Backward-compatibility rule:** The linter should accept `automated:` as a deprecated alias for `mode:` with a lint warning. It should also accept `off` and `full` as deprecated value aliases with a warning pointing to `mentor` and `autonomous`. This allows existing plans to degrade gracefully rather than fail validation.

**Default:** `mode: mentor` — the linter should treat a missing or empty `mode:` field as `mentor`, not as invalid, with an INFO-level suggestion to make it explicit.

**UI label:** In the Properties Pane dropdown and status page, display human-friendly labels:
- `mentor` → "Mentor (human-led)"
- `guided` → "Guided (collaborative)"
- `autonomous` → "Autonomous (AI-led)"

## Conclusion

The naming research recommends `mode: mentor | guided | autonomous` with backward-compatible aliases for the old values. The rename is mechanical and low-risk; every occurrence of `automated:` in plans, templates, the linter, the schema, and AI instructions can be updated in a single focused plan. See [[research/plan-execution-mode-tool-survey.md]] for the tool survey that informed this recommendation.

Next step: proceed to Step 3 (Web UI mocks per mode) using the `mentor | guided | autonomous` vocabulary.
