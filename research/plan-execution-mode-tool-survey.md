---
title: "Plan Execution Mode — Comparable Tool Survey"
status: concluded
question: "How do comparable AI-assisted tools model 'how much does the AI do' as a user-facing concept?"
conclusion: recommends
author: NetYeti
created: 2026-06-08
author-role: contributor
tags:
  - research
  - plan-modes
  - ai
  - ux
linked_proposals:
  - proposals/approved/research-plan-execution-modes.md
related_research:
  - research/plan-execution-mode-naming.md
---

# Plan Execution Mode — Comparable Tool Survey

## Questions Explored

- How do comparable AI-assisted tools model "how much does the AI do" as a user-facing concept?
- What names do they use for advisory vs. autonomous modes?
- What is the default mode?
- How is the mode enforced — by the system, by the AI, or by the user?

## Approaches Compared

| Tool | Mode model | Value names | Default | Enforcement pattern |
|------|-----------|-------------|---------|---------------------|
| **Cursor** | Session-level toggle | Chat / Agent | Chat (advisory) | Explicit UI selection required to enter Agent mode; chat is always available |
| **GitHub Copilot Workspace** | Always agentic | No mode concept | Autonomous | System always drives; human reviews plan before execution but cannot demote to advisory |
| **OpenCode** | Session-level toggle | Interactive / Agent | Depends on config | Agent mode uses tools autonomously; interactive chat is advisory only |
| **Linear Asks** | One-shot only | No mode concept | AI-driven single action | Always AI-generated output; human accepts/rejects; no ongoing advisory mode |
| **Aider** | Per-session flag | `--no-auto-commits` / agent | Interactive by default | `--yes` flag enables autonomous commits; default requires human confirmation per edit |
| **Devin** | Always autonomous | No mode concept | Fully agentic | Designed for autonomous execution; advisory mode is not a supported concept |

## Findings

### No tool embeds mode in the document

Every tool surveyed treats mode as a **session-level setting**, not a property of the artifact being worked on. DocWright's `automated:` frontmatter field is architecturally unusual — it stores the intended execution mode as part of the plan document itself. This is both more durable (the mode intent travels with the plan) and more complex (mode must be read and respected at runtime, not just at session start).

### The advisory/autonomous split is universal

All tools distinguish between:
- **Advisory** ("chat", "interactive", "ask"): AI suggests, human decides and executes
- **Autonomous** ("agent", "agentic", "composer"): AI acts, human reviews at gates

No surveyed tool has a three-way split comparable to DocWright's `off | guided | full`. The closest is a soft gradient in tools like Aider where confirmation granularity can be tuned, but even there it is not a named first-class concept.

### "Mentor" is not used — but the concept exists everywhere

No tool uses the word "mentor." The universal term for the advisory mode is **"chat"** (Cursor), **"interactive"** (Aider, OpenCode), or simply the default unnamed behavior. The positive intent of the DocWright `off` value — "the AI is your advisor, you are the one doing the work" — IS present in every tool, it just isn't given a distinctive name.

### Defaults almost always favor the advisory/interactive mode

Cursor, OpenCode, and Aider all default to the advisory/interactive mode. Copilot Workspace and Devin are the exceptions — they are purpose-built for autonomous execution and have no advisory mode. The implication for DocWright: **mentor mode being the default is correct and consistent with the industry pattern**.

### Enforcement is always system-driven, not AI self-regulation

Every tool that enforces mode does so through the UI (Cursor requires explicit mode switch) or via flags/configuration (`--yes` in Aider). None rely on the AI reading a document field and deciding how to behave. This is a signal that **DocWright's current purely-advisory enforcement is an outlier** — and that the enforcement contract must come from the system (Web UI button visibility, MCP tool behavior), not from AI instruction injection alone.

### The `guided` concept has no clean parallel

DocWright's `guided` mode (human + AI collaborate, AI drafts, human directs) does not have a clear analogue in any surveyed tool. The closest is Cursor's "apply" flow (AI writes code in chat, user clicks Apply to accept it), but that is ephemeral — not a named ongoing mode. This suggests `guided` is a DocWright innovation and may need the clearest documentation of the three modes.

## Sources

- Cursor documentation: chat vs. agent mode distinction and UI gating (training knowledge, 2024–2025)
- GitHub Copilot Workspace: task-plan-implement flow (training knowledge, 2024–2025)
- OpenCode docs: interactive vs. agent session configuration (training knowledge + local observation)
- Aider docs: `--yes`, `--auto-commits`, confirmation flow (training knowledge, 2024–2025)
- Linear Asks: one-shot AI issue generation (training knowledge, 2024–2025)
- Devin (Cognition): fully autonomous software engineer product positioning (training knowledge, 2024–2025)

## Conclusion

**Recommends the following for DocWright:**

1. Keep a three-way mode model — it captures a real distinction that other tools collapse. The `guided` middle mode is a DocWright contribution, not a defect.
2. Advisory-first default is correct. Every tool that has an advisory mode makes it the default. DocWright should do the same explicitly.
3. System enforcement over AI self-regulation. The tool survey shows that mode enforcement is always a system-level gate (UI, flags, configuration), never a document field the AI reads and obeys on its own. DocWright's enforcement contract must reflect this.
4. Name the advisory mode something positive. Every tool has an advisory mode; none call it "off". The rename is confirmed necessary by the survey.

See [[research/plan-execution-mode-naming.md]] for naming recommendations based on these findings.
