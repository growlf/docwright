---
complexity: high
title: "Multi-Perspective Review — Built-in Feature"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - review
  - opencode
  - governance
  - quality
  - phase-2
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - policies/core/multi-perspective-review.md
  - proposals/web-ui-ai-chat-panel.md
  - proposals/phase-gate-sign-off.md
---

## Problem

DocWright was built by triangulating between Claude, BigPickle (OpenCode's
configured LLM), and the BDFL. Each perspective caught things the others
missed. This practice — using multiple independent sources of analysis to
stress-test a decision — is one of the most effective quality mechanisms
in the project's history.

There is currently no built-in way for other DocWright users or organizations
to do the same thing easily. It requires knowing to ask, knowing which models
to use, and manually copying content between sessions. The friction means it
rarely happens outside of this project's core development practice.

DocWright should make multi-perspective review the path of least resistance,
not a discipline that requires remembering.

## What "multi-perspective" means

A perspective is any independent analysis of the same question from a source
that did not produce the original content:

- A different AI model (Claude reviewing BigPickle's draft; Gemini reviewing
  Claude's architecture proposal)
- A different prompt framing ("What's wrong with this?" vs. "How would you
  improve this?")
- A human reviewer who was not in the original conversation
- The same model asked to argue the opposite position ("Devil's advocate mode")

The value comes from independence. A model reviewing its own output is not a
second perspective — it is a reread.

## Proposed Features

### 1. "Second Opinion" quick action in the chat panel

A one-click button above the chat input (alongside the other quick actions)
that:
- Opens a new session on a *different* configured model (or prompts the user
  to pick one if multiple are configured)
- Pre-loads the current document as context
- Pre-fills the prompt: "Review this document critically. What is weak,
  missing, or potentially wrong? Be direct."

The result appears in the new session panel alongside the original. The
contributor reads both and synthesizes.

### 2. Formal review step in proposal and plan templates

A `## Multi-Perspective Review` section added to the proposal and plan
templates:

```markdown
## Multi-Perspective Review

| Reviewer | Type | Key findings | Date |
|----------|------|-------------|------|
| | | | |
```

This is not mandatory — it is a prompt. Its presence in the template means
the question "did you get a second opinion?" is always asked implicitly, even
when the answer is "not needed for this one."

### 3. Phase gate integration

The phase gate reviewer prompt (see [[proposals/phase-gate-sign-off.md]])
includes: "Did you seek a second perspective on any significant decisions in
this phase?" The answer is logged in `gate_note` — optional, but the question
is always asked.

### 4. AI self-flagging

All bundled `opencode-instructions.md` files include an instruction:

> "When you are uncertain, when you are making a significant architectural
> recommendation, or when you notice that you have been the primary voice on
> a decision, say so explicitly. Recommend that the contributor seek a second
> perspective from a different model or a human reviewer before proceeding."

The AI should not wait to be asked. It should volunteer the recommendation
when the situation calls for it.

### 5. Named perspective configurations (OpenCode agent personas)

OpenCode supports named agent configurations with different model and
instruction combinations. DocWright's `opencode.json` template ships with
two named agents:

```json
{
  "agents": {
    "docwright-assist": {
      "model": "...",
      "instructions": "You are helping build and maintain a DocWright vault..."
    },
    "docwright-critic": {
      "model": "...",
      "instructions": "You are a critical reviewer of DocWright vault content.
        Your job is to find problems, gaps, and weak assumptions.
        Be direct. Do not be polite about real issues."
    }
  }
}
```

The "Second Opinion" quick action defaults to opening a session with
`docwright-critic`. Organizations can configure the critic agent to use a
different provider than their primary assistant — getting genuine model
diversity, not just a different prompt.

## Connection to DocWright's own development

BigPickle (the configured OpenCode LLM used during DocWright's development)
is the original "docwright-critic" persona. The `opencode.json` for DocWright's
own vault should be committed with this configuration so future contributors
to DocWright itself can use the same multi-perspective practice that built it.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Side-by-side multi-model response view (query N models in parallel, display columns) | Excellent but complex UI work; sequential second-opinion covers most needs | [[proposals/parallel-model-review.md]] |
| Automated synthesis — AI reads multiple perspectives and produces a merged recommendation | Risk: synthesis by AI removes the human from the loop; careful design required | [[proposals/ai-perspective-synthesis.md]] |
| Voting / confidence scoring across models | Interesting for research; out of scope for governance tooling | [[proposals/model-voting.md]] |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — distilled from DocWright's own development practice | NetYeti |
