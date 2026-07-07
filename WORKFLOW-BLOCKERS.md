# Workflow Blockers — Dogfooding Freeze

**Status:** Active — blocking dogfooding cycle
**Last Updated:** 2026-07-07 20:40
**Context:** Attempted to dogfood issue→proposal→plan workflow; discovered multiple critical blockers in the API and governance layer.

---

## CRITICAL (Blocks everything)

### 1. Plan review endpoint hangs / ERR_INCOMPLETE_CHUNKED_ENCODING

**Issue:** `/api/plan-review` times out mid-stream when user clicks "Review" button on plans in the UI.

**Observed behavior:**
- First OpenCode call succeeds and streams initial status
- Subsequent calls (for step reviews, section reviews, synthesis) hang or fail silently
- Browser receives incomplete chunked response: `net::ERR_INCOMPLETE_CHUNKED_ENCODING`
- Endpoint timeout causes 504 or connection reset

**Root cause:** Unknown — requires debugging
- OPENCODE_URL is correctly set (`http://localhost:4096`)
- OpenCode backend is responsive (confirmed via `curl`)
- Issue is in the streaming loop or OpenCode call sequencing

**Blocking:**
- Cannot review any plan in the UI
- Plan workflow cannot be tested end-to-end
- User cannot approve plans without testing first

**Status:** Needs investigation

**Related code:**
- Endpoint: `src/webui/src/routes/api/plan-review/+server.ts` (lines 88, 120, 146 make OpenCode calls)
- Client: Review button in plan detail pages

---

## HIGH (Blocks core workflow)

### 2. Issue forward path UI missing

**Issue:** No UI button to move issues forward to proposals.

**Observed behavior:**
- Issue detail pages have no "Create Proposal" or "Link to Proposal" buttons
- Users must manually create proposal files and link them
- Workflow is invisible and tedious

**Blocking:**
- Issue→proposal workflow is manual and not self-documenting
- Cannot dogfood proposal creation workflow

**Status:** Proposed (proposal in `proposals/add-issue-forward-path-actions.md`, awaiting approval)

**Related code:**
- Proposal: `proposals/add-issue-forward-path-actions.md`
- Implementation: Needs new buttons + modals in issue detail page

---

### 3. capture_bug_report emits invalid frontmatter

**Issue:** The `capture_bug_report` command generates frontmatter that fails schema validation.

**Observed behavior:**
- Bug capture system creates new issues
- Generated frontmatter fails pre-commit validation
- Users cannot file bugs through the capture system

**Blocking:**
- Bug feedback system is broken
- Cannot dogfood the issue creation workflow

**Status:** Open (issue: `issues/bug-capturebugreport-emits-schema-invalid-frontmatter-.md`)

**Related code:**
- Needs investigation — check what fields capture_bug_report generates vs. what schema expects

---

### 4. Approve-by-move bypasses HUMAN_APPROVED gate

**Issue:** Moving a proposal file to `proposals/approved/` bypasses governance validation.

**Observed behavior:**
- User can move `proposals/X.md` → `proposals/approved/X.md` via git
- Proposal approval should require `HUMAN_APPROVED=1` in commit
- Moving file skips this gate

**Blocking:**
- Governance validation can be circumvented
- Security/audit concern

**Status:** Open (issue: `issues/bug-approve-by-move-bypasses-self-approval-gate.md`)

**Related code:**
- Pre-commit hook enforcement in `.githooks/`
- Approval workflow in `src/webui/src/routes/api/approve-proposal/+server.ts`

---

## MEDIUM (Impedes workflow)

### 5. Governance panel mislabeled and non-clickable

**Issues:**
- "Pending Approval" stat is mislabeled (should be "Awaiting Plan")
- Status stat tiles aren't clickable for drill-in to proposals

**Blocking:**
- Status dashboard is confusing
- Cannot quickly navigate to proposals that need action

**Status:** Open (2 issues: `governance-panel-pending-approval-stat-is-mislabel.md`, `governance-panel-status-stat-tiles-aren-t-clickabl.md`)

**Related code:**
- `src/webui/src/routes/status/+page.svelte` (governance panel rendering)

---

### 6. DNS resolution for .bms.local hostnames

**Issue:** `.local` is mDNS-reserved; fails to resolve from some clients.

**Observed behavior:**
- Remote users cannot consistently reach deployment instances at `.bms.local`
- Only works from clients with mDNS support (Bonjour, etc.)

**Blocking:**
- Inconsistent remote access
- Deployment validation blocked

**Status:** Open (issue: `issues/bug-bmslocal-deployment-hostnames-unresolvable-from-st.md`)

**Related:** Infrastructure/deployment configuration

---

## Resolution Order

1. **Plan-review hang** — unblocks all plan testing
2. **Issue forward-path UI** — unblocks issue→proposal workflow
3. **capture_bug_report validation** — unblocks feedback system
4. **Approve-by-move gate** — governance enforcement
5. **Governance panel UX** — dashboard clarity
6. **DNS resolution** — deployment infrastructure

---

## Notes

- Created during dogfooding session 2026-07-07
- This document is a living registry — update as issues are fixed or new blockers appear
- Link to specific issues/proposals in the lists above so they can be navigated quickly
