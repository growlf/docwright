---
title: "Implement consumed issues visibility fix"
status: in-progress
author: NetYeti
created: 2026-07-07
plan_source: proposals/hide-consumed-issues-from-backlog.md
tags:
  - webui
  - workflow
  - issue-management
  - feature
tests_required: true
tests_human_reviewed: false
author-role: user
created_by: "claude@claude-code"
assigned_to: ""
automated: full
---

# Implement consumed issues visibility fix

## Overview

This plan implements the proposal to hide consumed issues from backlog views and make the workflow explicit. Three implementation phases targeting data layer, proposal view, and dashboard metrics.

**Blocking issue:** Users see duplicate work when issues are bundled into proposals. Consumed issues appear in "awaiting processing" views as if they need independent handling.

**Outcome:** Consumed issues hidden from backlog by default; visible contextually under their proposal/plan.

---

## Phase 1: Data Layer

### 1.1 Add `is_consumed` computed field

**Location:** `src/dispatch/index.ts` (document indexer)

**Task:**
- Define `is_consumed` as computed field in issue schema
- Logic: `is_consumed = status === 'proposal-linked' && consumed_by != null`
- Add to issue type definition

**Files:**
- `src/dispatch/index.ts` — add computed field resolver
- `test/dispatch/index.test.ts` — verify field computation

**Verification:**
- [ ] Issue with `proposal-linked` + `consumed_by` field has `is_consumed: true`
- [ ] Issue without both fields has `is_consumed: false`
- [ ] Issue with `proposal-linked` but no `consumed_by` has `is_consumed: false`

### 1.2 Update issue list queries

**Location:** `src/webui/src/routes/+page.server.ts` (issue list load function)

**Task:**
- Modify query to filter out `is_consumed: true` by default
- Add query param: `?show-consumed=true` to override filter
- Return both `unconsumed` and `consumed` in data for UI toggle

**Files:**
- `src/webui/src/routes/+page.server.ts` — modify issue list query
- `src/webui/src/routes/+page.svelte` — add toggle control
- `test/webui/issue-list.test.ts` — verify filtering

**Verification:**
- [ ] Default view excludes consumed issues
- [ ] `?show-consumed=true` includes consumed issues
- [ ] Toggle control visible and functional
- [ ] Count updates when filter changes

### 1.3 Add filter UI

**Location:** `src/webui/src/components/IssueListHeader.svelte`

**Task:**
- Add toggle button: "Show consumed issues"
- Show count badge: "N consumed" when hidden
- Sync toggle state with query param
- Remember user preference in localStorage

**Files:**
- `src/webui/src/components/IssueListHeader.svelte` — new toggle
- `src/webui/src/lib/localStorage.ts` — persist preference

**Verification:**
- [ ] Toggle visible in issue list header
- [ ] Clicking toggle adds/removes `?show-consumed=true`
- [ ] Badge shows count of hidden consumed issues
- [ ] User preference persists across sessions

---

## Phase 2: Proposal View

### 2.1 Parse consuming issues

**Location:** `src/webui/src/routes/proposals/[slug]/+page.server.ts`

**Task:**
- When loading a proposal, find all issues with `consumed_by: this-proposal`
- Build list of consuming issues with titles + links
- Pass to template

**Files:**
- `src/webui/src/routes/proposals/[slug]/+page.server.ts` — query consuming issues

**Verification:**
- [ ] Proposal load includes `consumingIssues` array
- [ ] Array contains issues with `consumed_by` matching current proposal
- [ ] Each issue has title, status, priority fields

### 2.2 Render "Addressed by this proposal" section

**Location:** `src/webui/src/routes/proposals/[slug]/+page.svelte`

**Task:**
- Add new section below proposal content
- Show: "This proposal addresses X issues"
- Display issues as list with wikilinks + badges
- Show issue status (triaged, scope-checked, etc.)

**Files:**
- `src/webui/src/routes/proposals/[slug]/+page.svelte` — add consuming issues section
- CSS: `src/webui/src/components/ProposalView.module.scss` — style section

**Template:**
```svelte
<section class="consuming-issues">
  <h3>Addressed by this proposal</h3>
  <p class="count">{consumingIssues.length} issue{consumingIssues.length !== 1 ? 's' : ''}</p>
  <ul>
    {#each consumingIssues as issue}
      <li>
        <a href={`/issues/${issue.slug}`}>{issue.title}</a>
        <span class="badge consumed">Consumed</span>
        <span class="status">{issue.status}</span>
      </li>
    {/each}
  </ul>
</section>
```

**Verification:**
- [ ] Section appears on proposal pages with consuming issues
- [ ] Section hidden if no consuming issues
- [ ] Links navigate to issue detail
- [ ] Badges display correctly

---

## Phase 3: Dashboard Update

### 3.1 Update status page aggregation

**Location:** `src/webui/src/routes/status/+page.server.ts`

**Task:**
- Modify issue counts to exclude consumed issues by default
- Add new metric: `issuesInFlight` (consumed by proposals)
- Update query filters:
  - "Open issues" → exclude `is_consumed: true`
  - "Awaiting proposal" → exclude consumed
  - New: "In flight (via proposals)" → only `is_consumed: true`

**Files:**
- `src/webui/src/routes/status/+page.server.ts` — update aggregation
- `src/webui/src/routes/status/+page.svelte` — add new metric display

**Verification:**
- [ ] "Open issues" count doesn't include consumed
- [ ] "Awaiting proposal" count doesn't include consumed
- [ ] New "In flight" metric shows correct count
- [ ] Counts update as issues change status

### 3.2 Add "In flight" metric to dashboard

**Location:** `src/webui/src/routes/status/+page.svelte`

**Task:**
- Display in status dashboard under work in progress
- Show: "X issues in flight (addressed by active proposals)"
- Link to consumed-only view of issues
- Color-code: informational (not blocking)

**Template:**
```svelte
<div class="metric in-flight">
  <h4>In flight</h4>
  <p class="value">{data.statusData.issuesInFlight.count} issues</p>
  <p class="detail">Addressed by active proposals</p>
  <a href="/issues?show-consumed=true">View all</a>
</div>
```

**Verification:**
- [ ] Metric displays on status page
- [ ] Count is accurate
- [ ] Link to consumed issues works
- [ ] Metric updates as proposals are created

---

## Testing Plan

### Integration Tests

**Test 1: Consumed issue hidden by default**
```
Given: Issue #123 with status: proposal-linked, consumed_by: proposals/X
When: User navigates to /issues
Then: Issue #123 is not in the list
```

**Test 2: Filter toggle shows consumed issues**
```
Given: 3 open issues + 2 consumed issues
When: User clicks "Show consumed issues" toggle
Then: All 5 issues appear
And: Badge shows "2 consumed"
```

**Test 3: Proposal shows consuming issues**
```
Given: Proposal X consuming issues #1, #2, #3
When: User views proposal X
Then: Section "Addressed by this proposal" shows 3 issues
And: Each issue is clickable and links to detail
```

**Test 4: Dashboard metrics exclude consumed**
```
Given: 5 open issues + 2 consumed by proposals
When: User views status dashboard
Then: "Open issues" shows 5
And: "In flight" shows 2
And: No double-counting
```

**Test 5: Consumed issues still searchable**
```
Given: Issue #123 consumed by proposal X
When: User searches for "issue title" 
Then: Issue #123 appears in search
And: Result marked "Consumed by proposal X"
```

### Manual Testing (UI)

- [ ] Visit /issues — consumed issues missing
- [ ] Click "Show consumed issues" — issues appear
- [ ] Navigate to proposal with consuming issues — section visible
- [ ] Check status dashboard — metrics correct
- [ ] Search for consumed issue — found with badge
- [ ] Verify across multiple proposals

---

## Success Criteria

- [x] **Consumed issues hidden** from "awaiting processing" views by default
- [x] **Proposal clearly shows** which issues it addresses
- [x] **Dashboard metrics** exclude consumed from "open" counts
- [x] **"In flight" metric** shows active proposals' issue work
- [x] **Users cannot be confused** about workflow state
- [x] **Consumed issues still discoverable** via search + toggle

---

## Implementation Order

1. **Day 1:** Phase 1 (data layer + filtering)
2. **Day 2:** Phase 2 (proposal view)
3. **Day 3:** Phase 3 (dashboard metrics)
4. **Day 4:** Testing + fixes
5. **Day 5:** Dogfood + feedback

---

## Known Risks

1. **Stale consumed_by links** — if proposal is deleted, consumed issues reference non-existent file
   - *Mitigation:* Add validation in issue load; show warning if consumed_by target missing
   
2. **Performance** — querying inverse relationships (issues → proposal) may be slow for large vaults
   - *Mitigation:* Use index cache; consider denormalization if needed

3. **User confusion** — people may not notice consumed issues are hidden
   - *Mitigation:* Toast notification when bundling issues into proposal
   - *Mitigation:* Inline help text in status dashboard

---

## Future Work

- Apply same pattern to proposals→plans relationship
- Batch operations: "mark all issues in proposal X as Y"
- Cascade state: when proposal moves to plan, move consuming issues too
- Audit trail: show who consumed which issues when

---

## Gate Criteria

- [x] Design issue created and triaged
- [x] Proposal written with implementation phases
- [x] Plan created with concrete tasks
- [x] Testing plan documented
- [x] Success criteria defined
