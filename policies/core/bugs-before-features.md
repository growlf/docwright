---
title: "Bugs before features"
status: active
author: NetYeti
created: 2026-06-02
author-role: governance
tags:
  - policy
  - development
  - quality
  - security
---

## Statement

Known bugs are resolved before new feature work begins. This is the default
order of work. Exceptions exist but are rare and must be explicitly justified.

## Rationale

A bug is not merely an inconvenience — it is a gap between what the system
promises and what it delivers. Unresolved bugs:

- **Mislead feature development.** New features built on broken foundations
  inherit and amplify the breakage, often in ways that are not obvious until
  much later when they are far more expensive to fix.
- **Undermine reliability and trust.** Users and contributors cannot build
  confidence in a system that behaves inconsistently.
- **Create security exposure.** Many bugs are latent security issues. Deferring
  them defers the risk — but the risk does not disappear.
- **Increase cognitive load.** Open bugs occupy mental space and create
  workarounds that accumulate as technical debt.

Fixing bugs first streamlines feature development, simplifies the codebase,
and keeps the system reliable and secure at every stage — consistent with the
project's core philosophy: *Security first. Policy driven. Test verified at
every stage.*

## Scope

This policy applies to:
- All code changes in `src/`
- All plan and proposal prioritization decisions
- All AI-assisted development sessions

## Enforcement

When triaging plans and proposals, bug-fix work takes precedence over feature
work unless an exception is declared. AI agents working on this project must
check for open bug issues before beginning feature implementation.

The pre-commit hook and CI pipeline enforce code quality gates. Bypassing
them (`--no-verify`, skipping tests) is not permitted except in explicitly
documented emergencies, and the bypass must be followed immediately by a
remediation commit.

## Exceptions

Exceptions are permitted when:

1. A feature is required to unblock a critical external dependency or deadline,
   AND the relevant bugs are documented and scheduled for immediate follow-up.
2. A bug is confirmed not to affect the feature being developed and not to
   affect any user-facing surface in the current phase.
3. The bug is in a subsystem that is being replaced entirely by the feature work.

Exceptions must be noted in the plan or commit message with a brief justification.
They are not a license to ignore bugs indefinitely.

## Related

- Core philosophy: [[CLAUDE.md]]
- Order of work lifecycle: [[docs/SOPs/order-of-work-lifecycle.md]]
