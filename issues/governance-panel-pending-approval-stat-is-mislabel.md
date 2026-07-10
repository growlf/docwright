---
title: Governance panel: 'Pending Approval' stat is mislabeled (it's approved-awaiting-plan, not awaiting approval)
status: resolved
resolved: 2026-07-09
created: 2026-07-05
category: bug
part_of: plans/release-v0.5.0.md
priority: high
tags: []
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / high.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 112
assigned_to: []
created_by: NetYeti@host
---

Found dogfooding 2026-07-02. In the Governance panel (`src/webui/src/lib/GovernancePanel.svelte:147-150`), the stat tile labeled **"Pending Approval"** is bound to `approvedPending` (`d.proposals.approved_pending`).

But `approved_pending` means proposals that are **already approved and awaiting a *plan***, not proposals awaiting approval. So the label points users the wrong way: someone wanting to approve a proposal clicks toward "Pending Approval" — but the approvable ones are actually under **"Open Proposals"** (`openProposals`).

## Acceptance criteria
- [x] Relabel to reflect reality (e.g. "Awaiting Plan" or "Approved · No Plan Yet").
- [x] Ensure the term used for *unapproved* proposals ("Open Proposals") is clearly the approve-here bucket.
- [ ] (Optional) a short tooltip clarifying each stat's meaning.

## Resolution (2026-07-09)

Already relabeled to "Awaiting Plan" by earlier merged work; confirmed live via Playwright against the running dev server (`GovernancePanel.svelte` and the `/status` page's own stat grid both show the correct label, "Pending Approval" does not appear anywhere). Tracked under `plans/improve-bug-feature-reporting-tool.md` (Wave C, Step 4). The optional tooltip was not added.
