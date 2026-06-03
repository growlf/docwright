---
title: "Capture Deferred Ideas"
status: active
author: NetYeti
created: 2026-06-03
tags:
  - core
  - governance
  - workflow
  - ideas
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-03
---

# Capture Deferred Ideas

## Policy

Every plan and proposal that sets something aside — because it is out of scope,
premature, or dependent on future work — MUST capture that idea as a deferred
proposal before closing.

Good ideas that are not captured are good ideas that are lost. A deferred
proposal costs almost nothing to write and preserves the context of *why* the
idea arose, *what triggered it*, and *what it depends on*. That context is
almost always gone by the time the idea would have been relevant.

## What this means in practice

**When writing a plan:** include an "## Out of Scope" section. Any item listed
there becomes a deferred proposal before the plan is marked complete.

**When writing a proposal:** include an "## Out of Scope" section. Any item
listed there becomes a deferred proposal before the proposal is approved.

**When a plan gate fires:** the reviewer is asked "did anything come up during
this work that you are setting aside?" before sign-off. Answers become deferred
proposals.

**When an AI agent works on a plan:** the agent is instructed to note any ideas
that surface during implementation that are out of scope for the current work,
and to prompt the contributor to capture them.

## What a deferred proposal looks like

A deferred proposal is a normal proposal with:

```yaml
deferred: true
deferred_reason: "Brief explanation of why it is deferred and what it depends on"
related_to:
  - proposals/the-proposal-it-came-from.md
```

It appears in the **Deferred** section of the Vault Status page. It is never
deleted — only promoted to active when conditions are right, or explicitly
withdrawn with a written reason.

## Why this matters

DocWright is a governance layer. Its job is to make sure good thinking is not
lost and that decisions are traceable. A deferred idea is a decision: "this
is worth doing, but not now." That decision deserves the same care as any
other.

Organizations that adopt DocWright inherit this practice. The bundled profiles
and AI instructions actively reinforce it.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created as core policy | NetYeti |
