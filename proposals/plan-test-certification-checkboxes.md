---
complexity: medium
title: "Plan Test Certification — Honest Simplified Design"
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - testing
  - enforcement
  - phase-1
category:
  - governance
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/plan-step-completion-enforcement.md
  - proposals/plan-complete-blocks-on-pending-steps.md
  - policies/core/ai-governance-boundaries.md
  - proposals/skill-plan-critique.md
---

## The Honest Problem Statement

Plans can be marked complete without evidence that work was verified. Multiple
prior designs — the `## Testing Plan` section, two checkboxes, and a
multi-layer enforcement system — were critiqued and found to share the same
root cause:

> **Every enforcement layer is mutable by the same agent it intends to constrain.**

An agent with write access to the repository can modify the test runner, the
pre-commit hook, the plan content, git timestamps, and YAML — in any order. A
complex layered system does not raise the security ceiling for a *deliberate*
bypass. It raises the maintenance burden while providing the same effective
protection as a simple system.

**Independent analysis from two AI systems (Claude and OpenCode/BigPickle)
reached identical conclusions:** advisory rules don't hold; wrappers can be
bypassed by using underlying tools directly; the honest ceiling without
architectural sandboxing is "makes violations obvious and harder accidentally."

The prior complex design was also critiqued by the human reviewer with seven
specific flaws, all stemming from the same root:

1. Test runner is a single point of trust — AI can overwrite it to always pass
2. Runner executes arbitrary commands from plan content — security hole
3. Challenge-response records unverifiable answers — theater
4. MCP gate bypass via YAML — same advisory enforcement the proposal criticizes
5. Hook can be modified by the same AI it constrains
6. Test count proxy is weak — trivial tests satisfy count without regression value
7. Committed artifact can be fabricated — comment and format are reproducible

**Conclusion:** complexity above the ceiling is unjustified. Simplify to the
minimum that is useful and be honest about what it achieves.

---

## What Actually Raises the Ceiling

Only three mechanisms genuinely constrain an agent with write access:

1. **External immutability** — GitHub Actions required status checks with branch
   protection. The AI can modify workflow files, but cannot disable branch
   protection without repository admin access. CI running in an external
   environment is a genuine gate the committer cannot bypass from within the repo.

2. **Private key possession** — GPG-signed commits. The AI does not have the
   user's private key. A signed commit proves a human physically ran the commit.
   This is the only signing mechanism in the entire stack the AI cannot replicate.

3. **Architectural separation** — `.githooks/` as a read-only directory to the
   AI process. Requires sandboxing. Out of scope for Phase 1.

Everything else — hooks, runners, MCP gates, checkboxes — protects against
*accidental* violation, not *deliberate* adversarial bypass.

---

## The Simplified Design

### What it achieves

- Makes test results **visible** (not tamper-proof)
- Catches **accidental omissions** (not determined adversaries)
- Creates **attribution** — who certified what, when, in git history
- Provides a **commitment artifact** humans can review in the diff
- **External gate** via branch protection for the actual security floor

### What it does not achieve

- Prevention of determined AI adversarial bypass
- Verification that tests are *meaningful* (test quality remains human judgment)
- Technical enforcement without human diff review

### The components

**1. Test runner (`scripts/run-plan-tests.js`)**

Runs tests defined in the plan's `## Tests` table and writes results to
`## Test Results`. Produces visible evidence, not tamper-proof evidence.
The human reviews this section in the diff like any other file change.

**2. One hook check**

When `status: completed` is being committed, the hook verifies:
- `## Test Results` section exists in the plan body
- All rows in that section contain ✅ Pass

Catches accidents (forgot to run tests, tests failed but committed anyway).
Does not catch deliberate fabrication — a determined agent can fake the section.

**3. `tests_defined` — a single checkbox**

```yaml
tests_defined: false
```

A human checks this via the Web UI PropertiesPane. Tooltip:
> *"I've reviewed these tests and they would catch regressions if the
> implementation were wrong."*

One checkbox, not two. This is a **commitment**, not enforcement. The human
is certifying adequacy of the test suite. Attribution is recorded in git history.

When `tests_defined` changes to `false`, the hook clears `## Test Results`
(the suite changed; old results are no longer valid).

The challenge-response (asking "which deliverable does test #3 verify?") is
**dropped entirely** — an unverified answer is theater; a verified answer can
be computed by the AI; neither helps.

**4. Human reads the diff**

The actual security gate. When the human reviews the commit diff before running
it, they see:
- The `## Test Results` section with actual runner output
- The `tests_defined: true` change
- The `status: completed` change

A fabricated test results section looks different from a runner-generated one.
This review is not automated — it is the human applying judgment to visible
evidence. It cannot be replaced by code.

**5. Branch protection + required CI (the real external gate)**

GitHub branch protection with required status checks is the one mechanism an
agent with write access cannot bypass without repository admin access. CI runs
in an external environment. If CI must pass before merge is allowed:

- Tests genuinely run in an environment the committer doesn't control
- Results are externally produced, not self-reported
- The AI can modify CI workflow files, but branch protection remains

This is Phase 1 for DocWright's own repo. For deployed vaults, Forgejo's
equivalent branch protection serves the same role.

---

## Plan frontmatter additions

```yaml
tests_defined: false   # human checkbox: test suite is adequate
```

The `## Tests` and `## Test Results` sections live in the plan body (not
frontmatter). The runner produces `## Test Results`. The human writes `## Tests`.

**The hook also enforces:**
- `tests_defined: true` requires `HUMAN_APPROVED=1` (same as `approved: true`)
- `status: completed` requires `tests_defined: true` AND `## Test Results`
  with all rows passing

**No `tests_passed` field** — the committed `## Test Results` section IS the
evidence. A separate boolean is redundant and adds a checkbox that can be
fabricated independently of the evidence.

---

## What the critique tool does

When `/critique-plan` runs on a plan with `tests_defined: false`:

1. Generates the `## Tests` table with concrete test cases per deliverable
2. Each test row must name: the command to run, which deliverable it verifies,
   the expected output
3. Flags staleness if deliverable count has grown since tests were last defined
4. Does NOT auto-set `tests_defined: true` — human reviews and checks it

---

## Migration of existing plans

A migration script adds `tests_defined: false` to all active plans. Existing
plans are not immediately blocked for completion — the grace period ends at
Phase 2 start, when all active plans must have a `## Tests` section before
any Phase 2 work begins.

---

## What this design honestly provides

| Scenario | Protected? |
|---|---|
| Developer forgets to run tests | ✅ Hook catches missing Test Results section |
| Developer runs tests, some fail, tries to commit anyway | ✅ Hook checks all rows ✅ |
| AI accidentally completes plan without tests | ✅ Hook catches it |
| AI deliberately fabricates test results | ❌ Not prevented — human diff review is the gate |
| AI modifies the hook to bypass | ❌ Not prevented — same ceiling |
| Human rubber-stamps without reading diff | ❌ Not prevented — human judgment required |
| External CI required by branch protection | ✅ Genuinely external, cannot be bypassed from within repo |

The design is honest about its scope. It is not a security system against a
determined adversary with write access. It is a visibility and accountability
system that catches accidents, surfaces evidence for human review, and provides
an external gate via CI that is genuinely harder to bypass.

---

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Cryptographic signing of test results | Strong mechanism; requires GPG setup or sigstore integration — Phase 3+ |
| Read-only `.githooks/` via sandboxing | Requires architectural change — post-launch |
| Mandatory independence (second reviewer) | Team structure required — warn for solo, block for teams in Phase 3 |
| Verified challenge-response | Cannot be made meaningful without the AI computing the answer — dropped |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created with two checkboxes | NetYeti |
| 2026-06-04 | Self-critiqued; findings partially resolved | NetYeti |
| 2026-06-04 | Redesigned: tests_passed → committed artifact; multi-layer system | NetYeti |
| 2026-06-04 | Honest simplification after 7-point human critique: all layers mutable by same agent. Dropped challenge-response and tests_passed field. Single checkbox + runner + one hook + branch protection | NetYeti |
