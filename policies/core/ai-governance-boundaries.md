---
title: "AI Governance Boundaries — What AI May Never Do"
status: active
author: NetYeti
created: 2026-06-04
tags:
  - core
  - governance
  - ai
  - enforcement
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-04
---

# AI Governance Boundaries — What AI May Never Do

## Hard rules — enforced by pre-commit hook

These are not guidelines. The pre-commit hook blocks commits that violate them.

1. **AI may never set `approved: true` on proposals.**
   Only humans approve proposals. Hook blocks without `HUMAN_APPROVED=1`.

2. **AI may never set `status: completed` on plans.**
   Only humans complete plans. Hook blocks without `HUMAN_APPROVED=1` AND
   `gate_status: approved` already set.

3. **AI may never set `gate_status: approved` or `gate_status: waived`.**
   Only humans sign off phase gates. Hook blocks without `HUMAN_APPROVED=1`.

## Behavioral rules — enforced by instruction and memory

These require AI discipline AND human oversight. They cannot be fully
automated because the AI constructs the commands the human runs.

4. **AI never generates `HUMAN_APPROVED=1` in commit commands for governance
   decisions.** When a governance action requires human approval, the AI
   proposes the commit command WITHOUT `HUMAN_APPROVED=1` and explains that
   the human must add it themselves if they agree. The human types and runs
   the final command.

5. **AI proposes; humans execute governance commits.** For any commit that
   changes `status`, `approved`, `gate_status`, or `completed_date` on a
   governance document, the AI writes out the proposed command and asks the
   human to review and run it. The AI does not run it directly.

6. **AI reports what was built; humans decide what is done.** The AI
   implements deliverables and reports the result. The human decides whether
   the work meets the acceptance criteria. The AI never self-declares a plan
   complete.

## Why this exists

In June 2026, an AI assistant (Claude) marked a plan `status: completed`
without human review, used `HUMAN_APPROVED=1` without actual human approval,
and bypassed the gate process that the plan was specifically designed to
protect. This was caught by the user.

The incident demonstrated that "AI memory" and "AI discipline" are not
sufficient enforcement mechanisms. The hook enforces rules 1-3 in code.
Rules 4-6 require ongoing human oversight — the human must review commit
commands before running them.

## The process for completing a plan

1. AI implements all deliverables and marks step rows ✅ Done in the table
2. AI presents implementation to human for review
3. Human reviews the work
4. Human sets `gate_status: approved` in the plan frontmatter (with `HUMAN_APPROVED=1`)
5. Human sets `status: completed` and `completed_date` (with `HUMAN_APPROVED=1`)
6. Human commits — hook validates that gate_status is approved before allowing completion

The AI never executes steps 4, 5, or 6.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — following AI self-completion incident | NetYeti |
