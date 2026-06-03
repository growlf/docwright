---
complexity: low
title: "Lifecycle Gates — Retroactive Audit of Past Transitions"
author: NetYeti
created: 2026-06-03
tags:
  - governance
  - gates
  - audit
  - improvements
approved: false
deferred: true
deferred_reason: "Depends on base gate mechanism (see proposals/phase-gate-sign-off.md). Revisit after launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/phase-gate-sign-off.md
---

## Problem

The base gate mechanism enforces checkpoints going forward. It does not flag
transitions that already happened without a gate — documents that moved from
`draft` to `active` before gate enforcement existed, plans that completed
without a reviewer sign-off, phases that advanced without review. In a vault
being adopted mid-lifecycle, this leaves unknown compliance gaps.

## Proposed Solution

A **retroactive audit** command and dispatch function that scans the vault for
transitions that should have had a gate but did not:

```
docwright gate-audit [--profile org-operations] [--fix]
```

Audit output:
- Lists every document where a gated transition occurred without a recorded
  `gate_status: approved` or `gate_status: waived`
- Annotates each finding with the gate rule that would have applied
- With `--fix`: stamps each flagged document with `gate_status: waived` and
  `gate_note: "Retroactive audit — gate did not exist at time of transition"`
  so the record is honest and searchable

The MCP server gains a `docwright_gate_audit` tool. The status page gains an
optional **Audit** tab showing outstanding retroactive findings.

This is particularly valuable for organizations adopting DocWright into an
existing vault where years of transitions predate the gate mechanism.

## Deferred Because

Base gate mechanism must be stable and in production use before retroactive
audit has a meaningful rule set to enforce against.
See [[proposals/phase-gate-sign-off.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from base gate proposal out-of-scope | NetYeti |
