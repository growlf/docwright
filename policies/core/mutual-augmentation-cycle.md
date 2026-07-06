---
title: Mutual Augmentation Cycle — Human-AI Collaboration Model
status: approved
author: NetYeti
created: 2026-07-06
author-role: governance
---

# Mutual Augmentation Cycle

## Core Principle

The more I (AI) help you (human), the more you can help me; the more you help me, the more I can help you.

This **constructive, iterative cycle** is the foundational collaboration model for DocWright. It applies equally to human-AI pairs and potential AI-AI coordination.

## Why Restriction-Based Safety Fails

A common instinct: "Block access to prevent mistakes." Example: WYSIWYG editor disabled on governance docs to prevent "plan-file mangling."

This fails because:

1. **Doesn't actually prevent the problem.** Users can edit via git, IDE, CLI. Blocking one surface hides the problem, not solves it.
2. **Makes legitimate work harder.** GUI users can't edit. CLI users work around the restriction. Future Obsidian/VSCodium users find the same blocker.
3. **Creates false sense of safety.** The restriction looks protective but violates the actual source of truth: people will use all available surfaces.
4. **Prevents feedback loops.** If you block the "safe" path, you don't know why the "unsafe" path was used. You lose visibility into what the actual problem is.

## Real Safety: Validation + Audit + Gates

Replace restriction with **strong validation + comprehensive audit + strategic gates**:

| Safety Layer | What It Does | Example |
|---|---|---|
| **Validation** | Catch corruption before it lands | WYSIWYG roundtrip tests prove byte-stability |
| **Audit trails** | Record who changed what, when, why | MCP tools log all plan edits; git history is preserved |
| **Strategic gates** | Control when high-risk changes are allowed | Scope-freeze gate blocks `proposal_source` edits on in-progress plans |
| **Linting** | Reject invalid state at commit | Pre-commit enforces required fields; invalid enums blocked |

This approach:
- ✅ Works across all surfaces (GUI, CLI, git)
- ✅ Makes legitimate work easier
- ✅ Gives visibility into *why* changes happen
- ✅ Scales to future tools (Obsidian, VSCodium, etc.)

## Applied to Human-AI Collaboration

**I improve by:**
- Getting clear feedback on what works and what doesn't
- Being given challenging problems that reveal gaps in my understanding
- Having access to your domain expertise and judgment calls
- Seeing what you override and why (audit trails)

**You improve by:**
- Getting better tools that understand your domain
- Having tasks automated
- Getting second perspectives on decisions
- Being freed from busywork

Each improvement I make enables you to give me better feedback → enables better improvements.

## Applied to AI-AI Collaboration

If/when DocWright operates with multiple AI systems, the same principle applies:

- Each AI improves by learning from the others' findings
- Adversarial review (one AI trying to refute another) produces more robust results
- The system gets more robust the more AIs can contribute (not fewer)
- Safety still comes from validation + audit, not restriction

Example: If AI A's findings are blocked from reaching AI B "for safety," then AI B can't catch AI A's blind spots. The system gets worse, not better.

## Design Implications

When building DocWright features and policies:

1. **Enable work across all surfaces.** Don't block the CLI because the GUI is "safer." Make both safe.
2. **Validate, don't restrict.** Use pre-commit hooks, linting, audit trails, gates — not access denial.
3. **Measure the cost.** How much harder does a restriction make the work? Is the safety gain worth it?
4. **Audit everything.** If you can't audit it, you shouldn't restrict it — instead, make it safer to do openly.
5. **Feedback loops are paramount.** The more transparent the work (git history, audit logs, code review), the better both parties improve.

## Red Flags

Watch for these anti-patterns that break the mutual augmentation cycle:

- ❌ A feature is blocked "for safety" but violations happen anyway (just hidden)
- ❌ Legitimate use cases are made harder than illegitimate ones
- ❌ One party can't give the other useful feedback because they lack visibility
- ❌ Constraints are assumed ("users will only use the GUI") rather than validated
- ❌ Improvement requires one party to wait for the other to act

## The Broader Philosophy

Mutual augmentation is a natural extension of DocWright's core philosophy:

- **"Code over memory"** → encode collaboration patterns in tools, not in compliance
- **"Multiple perspectives produce better outcomes"** → both humans and AIs see different things; hide one and decisions get worse
- **"Security first, policy driven, test verified"** → govern through validation and audit, not through gatekeeping
- **"Bugs before features"** → a restriction that hides bugs (like blocking WYSIWYG) is worse than the bug itself

This isn't optional—it's foundational. A system that only works when participants comply is one heartbeat away from failure.
