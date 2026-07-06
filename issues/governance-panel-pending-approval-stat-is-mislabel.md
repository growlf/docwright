---
title: Governance panel: 'Pending Approval' stat is mislabeled (it's approved-awaiting-plan, not awaiting approval)
status: scope-checked
created: 2026-07-05
category: bug
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
milestone: backlog
assigned_to: []
created_by: NetYeti@host
---

Found dogfooding 2026-07-02. In the Governance panel (`src/webui/src/lib/GovernancePanel.svelte:147-150`), the stat tile labeled **"Pending Approval"** is bound to `approvedPending` (`d.proposals.approved_pending`).

But `approved_pending` means proposals that are **already approved and awaiting a *plan***, not proposals awaiting approval. So the label points users the wrong way: someone wanting to approve a proposal clicks toward "Pending Approval" — but the approvable ones are actually under **"Open Proposals"** (`openProposals`).

## Acceptance criteria
- [ ] Relabel to reflect reality (e.g. "Awaiting Plan" or "Approved · No Plan Yet").
- [ ] Ensure the term used for *unapproved* proposals ("Open Proposals") is clearly the approve-here bucket.
- [ ] (Optional) a short tooltip clarifying each stat's meaning.
