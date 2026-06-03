---
title: "Multi-Perspective Review"
status: active
author: NetYeti
created: 2026-06-03
tags:
  - core
  - governance
  - ai
  - review
  - quality
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-03
---

# Multi-Perspective Review

## Policy

No single AI model, and no single person, has complete knowledge or perfect
judgment. Important decisions — proposals, plans, architecture choices, policy
drafts — SHOULD be reviewed from more than one perspective before being
finalized.

A perspective is any independent source of analysis: a different AI model, a
different human reviewer, a different framing of the question. Diversity of
perspective is not a luxury. It is a quality mechanism.

## Origin

DocWright itself was built by triangulating three perspectives in every session:

- **Claude** (Anthropic) — reasoning, writing, architecture, long-context
  synthesis
- **BigPickle** (OpenCode's configured LLM, accessed via `opencode serve`) —
  independent review, alternative angles, catching what Claude missed
- **NetYeti** (BDFL, human) — product vision, final judgment, lived context
  that neither model has

Each checked the others. The result was consistently better than any one of
them alone would have produced. This is the practice DocWright is built to
transmit.

## What this means in practice

**For proposals:** Before approving a significant proposal, consider asking at
least one other AI model to critique it. The question "what's wrong with this?"
asked of a different model often surfaces assumptions the original author and
their primary AI didn't question.

**For plans:** Before starting implementation, a second-perspective review of
the plan's steps can catch gaps, sequencing errors, and missing rollback
procedures that familiarity bias hides.

**For policies:** Policies that govern others should be reviewed by someone
other than their author — human or AI. Blind spots in policy language create
compliance gaps.

**For architecture decisions:** When choosing between approaches, assign
different models to argue for different options. A model defending an approach
it did not choose often finds the real trade-offs faster than one that
proposed it.

## What DocWright does to support this

- The chat panel (Phase 2) supports multiple AI providers via OpenCode. Any
  configured provider can be used for a second-perspective review without
  leaving the vault.
- Quick action prompts include "Get a second opinion" as a one-click path to
  opening a new session on a different model with the current document as
  context.
- The phase gate mechanism asks the reviewer: "Have you sought a second
  perspective on this phase's outcomes?" The answer is optional but the
  question is always asked.
- `opencode-instructions.md` for all profiles instructs the AI to acknowledge
  its own uncertainty and to recommend a second perspective when it is unsure.

## The human is always the synthesizer

Multiple perspectives create information. They do not make decisions. The human
contributor — or the designated reviewer — reads the perspectives, weighs them,
and makes the call. The AI's job is to make that synthesis easy, not to replace
it.

A multi-perspective review that ends in an AI making the final decision has
defeated its own purpose.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created as core policy — distilled from DocWright's own development practice | NetYeti |
