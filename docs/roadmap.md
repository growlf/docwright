# DocWright Roadmap

Authoritative sequencing of all open work. For project goals and architecture,
see [[PROJECT.md]]. This document owns the *when* and *why now*.

Last reviewed: 2026-07-01

---

## How to read this document

Work is ordered within each phase by **structural dependency** — earlier items
unlock later ones. Items marked ⚡ are blockers: downstream work cannot start
without them. Items marked 🔀 run as **parallel tracks** independent of the
current phase gate.

---

<!-- START_ROADPLAN -->

### 🎯 Current Milestone (v0.5.0)

| Type | Title | Phase | Priority | Status | Assigned |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ✨ Plan | [[plans/roadplan-view.md\|Step 4: Derived roadplan view]] | Phase 4 | high | in-progress | netyeti |

### 🚀 Next Milestone (Next)

_No items assigned to this milestone_

### 🗺 Future Pool Milestone (Future Pool)

| Type | Title | Phase | Priority | Status | Assigned |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🐛 Issue | [[issues/bug-approve-by-move-bypasses-self-approval-gate.md\|Approving by moving a proposal to proposals/approved/ bypasses the HUMAN-APPROVED gate]] | — | high | open | — |
| ✨ Plan | [[plans/separate-dev-tracking-milestones-and-beta-channel.md\|Base Process-Flow: code-issue/governance split, docwright-dev profile, milestones, and beta channel]] | Phase 2 | high | in-progress | NetYeti |
| 🐛 Issue | [[issues/bug-complete-plan-stray-copy-and-no-refresh.md\|Completing a plan writes a stray docs/ duplicate and doesn't live-refresh the panel]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-governance-hooks-silently-disabled-docwright-path.md\|Governance hooks silently disabled when DOCWRIGHT_PATH is unset (non-interactive shells)]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-hook-source-divergence-and-commit-msg-not-installed.md\|Hook source drift — .githooks diverged from scripts/pre-commit.sh, and commit-msg is never installed for vaults]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-plan-generator-from-approved-proposal.md\|Plan generator (approve → plan) dumps the whole proposal, mangles frontmatter, and mints an unreviewed 'approved' plan]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-human-approved-precommit-check-broken.md\|Pre-commit HUMAN-APPROVED check is broken — reads stale COMMIT_EDITMSG]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-session-start-blind-to-unmerged-work.md\|Session-start is blind to unmerged branches and open issues — parked work silently vanishes]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-webui-lifecycle-actions-not-committed-to-git.md\|Web UI lifecycle actions write to the working tree but never commit to git — the root of the approval-flow friction]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-webui-save-silently-flips-tests-defined.md\|Web UI save silently flips tests_defined and reruns syncTestCriteria as a side effect]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-wysiwyg-editor-corrupts-documents.md\|WYSIWYG editor corrupts documents and clobbers frontmatter on save]] | — | high | open | — |
| 🐛 Issue | [[issues/bug-approve-not-idempotent-stale-consumed-by.md\|Approve button silently no-ops when a stale consumed_by points at a missing plan]] | — | medium | open | — |
| 🐛 Issue | [[issues/bug-research-smoke-profile-coverage-fails.md\|research-smoke tests fail: asset-management profile missing research type; test hardcodes '4 profiles']] | — | medium | open | — |
| ✨ Plan | [[plans/contribution-pipeline.md\|Sub-Plan: Contribution Pipeline & Friction Log]] | Phase 5 | medium | in-progress | NetYeti |
| 🐛 Issue | [[issues/bug-tests-pollute-real-audit-log.md\|Test suite writes to the real audit/lifecycle.jsonl instead of an isolated temp store]] | — | medium | open | — |
| 🐛 Issue | [[issues/bug-session-end-push-rejected-on-protected-main.md\|scripts/end-session.ts pushes directly to main and fails on branch protection — needs to branch+PR instead]] | — | low | open | — |

<!-- END_ROADPLAN -->

---

## Dependency Graph

```
Phase 3 (foundation + perception + pilots)
  3a (vault write API)
    ──→ 3b (vault document index — frontmatter + wikilink edges, unified)
          ──→ 3c (knowledge graph — accurate from day one)
  3a, 3b, 3c ──→ 3d (MSP pilot) ──→ 3e (STEAM pilot) ──→ 3f (dogfooding)
  │
  ├──→ 🔀 Cascade STEAM production [waits for Phase 5 step 5b ACL]

Phase 4 (governance enforcement — serial)
  4a (mode enforcement) ──→ 4b (profile engine) ──→ 4c (lifecycle gates)

Phase 5 (profile-aware features — largely parallel after Phase 4)
  ├── 5a (judgment atom mode)    [needs 4c]
  ├── 5b (Forgejo ACL)           [needs 4b] ──→ closes STEAM production track
  ├── 5c (research AI + RLM*)    [needs 4b + ai-stack GPU fix]
  ├── 5d (proposal UX + dedup)   [needs 3b ✓, 4b for full features]
  ├── 5e (contribution pipeline) [independent]
  └── 5f (graph polish)          [driven by real usage of 3c]
  │
  🔀 Chat & Session Panel Ph2    [no phase dependency — closes here]

Phase 6 (feature bundles — real user feedback required)
Phase 7 (public release)

* RLM: [[proposals/deferred-rlm-python-microservice.md]]
  Pending ai-stack GPU fix. Policy atom pre-condition met (v0.3.x).
```

Small fixes and 5e (contribution pipeline) have no phase dependencies.
