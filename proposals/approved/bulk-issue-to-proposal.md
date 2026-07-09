---
title: Bulk Issue Selection → Proposal Creation Workflow
author: Claude (on behalf of user)
created: 2026-07-07
tags:
  - webui
  - workflow
  - issues
  - proposals
  - bulk-actions
approved: true
created_by: claude@claude-code
assigned_to: NetYeti
_path: proposals/approved/bulk-issue-to-proposal
consumed_by: plans/bulk-issue-to-proposal.md
---

## Problem

Currently, creating a proposal from related issues requires:
1. Manually identifying which issues belong together
2. Creating a new proposal file
3. Manually linking or referencing each issue in the proposal text
4. Updating issue status to reflect that they're now part of a proposal

This is friction-heavy and error-prone. Issues and proposals are separate discovery paths in the UI, making it hard to see relationships at creation time.

A contributor triaging issues should be able to:
- Select multiple related issues in bulk
- Click "Create proposal from selection"
- Get a pre-populated proposal template with issues listed
- Link is automatically established (proposal → issues + issues → proposal)

## Proposed Solution

### 1. Issues List UI Enhancements

**Add selection mode to the issues list:**
- Checkbox column (hidden by default, enabled by toggle button)
- Bulk action toolbar appears when items selected:
  - "Create proposal from selection" button (primary)
  - "Change status" dropdown
  - "Assign to" selector
  - Selection counter: "3 issues selected"

**Keyboard shortcuts:**
- `Cmd/Ctrl + A` — Select all visible issues
- `Cmd/Ctrl + Shift + A` — Deselect all
- `Escape` — Exit selection mode

### 2. Proposal Creation from Issues

**Modal Flow:**

1. **Confirm & Populate** (step 1)
   - Show list of selected issues (with titles, current status)
   - Confirm: "Create proposal from these 3 issues?"
   - Option: "Auto-populate from issue titles" toggle (default: on)

2. **Proposal Template** (step 2)
   - Pre-fill:
     - **Title:** Auto-suggested from common theme of issues (or editable)
     - **Problem:** Aggregated summary from issue summaries
     - **Proposed Solution:** Template sections referencing each issue
   - Show preview with wikilinks already in place: `[[issues/ISS-0001]]`, `[[issues/ISS-0002]]`, etc.

3. **Create** (step 3)
   - Choose: 
     - Mark all selected issues as `status: consumed` (new status)
     - OR leave as-is (user decides later when reviewing proposal)
   - Create proposal file
   - Create audit log entry: "Proposal created from issues: ISS-0001, ISS-0002, ISS-0003"
   - Create reverse links: each issue gets `consumed_by: proposals/bulk-issue-to-proposal.md` (optional field)

### 3. Data Model Changes

**Issue frontmatter additions:**
```yaml
---
type: issue
status: triaged | in-proposal | consumed  # new status option
created: YYYY-MM-DD
consumed_by: proposals/my-proposal.md     # optional: backlink to consuming proposal
---
```

**Proposal frontmatter additions:**
```yaml
---
title: "..."
author: NetYeti
created: 2026-07-07
tags: [...]
sources:                                   # new: issues that informed this proposal
  - issues/ISS-0001.md
  - issues/ISS-0002.md
  - issues/ISS-0003.md
---
```

### 4. UI Components

**Issues List (existing, enhanced):**
- Add SelectionContext (show/hide checkbox column)
- Checkbox in each row
- Bulk toolbar with actions
- Selection state persists during session (optional: in URL state for shareable links)

**Create Proposal Modal (new):**
- Step-by-step wizard
- Preview of proposed title and summary
- List of issues to be consumed
- "Auto-populate from issues" toggle
- Create button (disabled if no title)

**Proposal Editor (enhancement):**
- Show `sources:` section at top
- Each source is a clickable wikilink to the issue
- Visual indicator: "This proposal was created from issues" badge

**Issues List Item (enhancement):**
- Show `consumed_by: proposals/X.md` in metadata
- If consumed: gray out, show "→ proposals/X.md" link
- Can be re-opened if needed (admin action)

### 5. Workflow & Status Model

**Issue statuses over time:**
```
inbox → triaged → consumed → (optional: resolved when proposal approved)
                 ↓
             in-proposal (if user selects this option)
                 ↓
              resolved (when parent proposal is approved)
```

**Proposal → Issue relationships:**
- Proposal links issues via `sources:` frontmatter
- Issues link back via `consumed_by:` frontmatter
- Bidirectional wikilinks (both directions indexed)

**Closure semantics:**
When a proposal transitions to `approved`:
- All issues in `sources:` can be auto-marked as `resolved` (option for user)
- OR user manually resolves each issue as work completes
- If proposal is `rejected`, issues revert to `triaged` (manual decision)

### 6. API Endpoints (if using MCP)

```
POST /api/proposals/from-issues
  body: { issueIds: ["ISS-0001", "ISS-0002"], title?: string }
  returns: { proposalTitle, previewMarkdown, issues: [...] }

POST /api/proposals
  body: { title, body, sourcedFromIssues: ["ISS-0001", "ISS-0002"] }
  returns: { proposalPath, audit }
```

## Scope

### UI Implementation (webui)
- [ ] Issues list selection mode (checkboxes, bulk toolbar)
- [ ] "Create proposal from selection" modal
- [ ] Step-by-step wizard with preview
- [ ] Frontmatter fields `consumed_by` and `sources`
- [ ] Display consumed_by link in issue list/detail
- [ ] Display sources in proposal editor
- [ ] Tests: selection, modal flow, auto-populate

### Backend/Data (dispatch)
- [ ] Add `consumed_by` to issue schema validation
- [ ] Add `sources` to proposal schema validation
- [ ] Bidirectional wikilink indexing (proposal → issues + issues → proposal)
- [ ] Status transition rules (triaged → consumed → resolved)
- [ ] Tests: schema validation, status transitions, audit logging

### Documentation
- [ ] User guide: "Creating proposals from issues"
- [ ] Workflow diagram: inbox → triaged → proposal
- [ ] Examples: before/after screenshots

## Alternatives Considered

### 1. Select issues in proposal editor after creation
**Rejected:** Requires creating proposal first (blank), then linking. Higher friction. Doesn't auto-populate from issue data.

### 2. No UI — manual linking in markdown
**Rejected:** Contradicts "code over memory" principle. Should be enforced in UI, not left to user discipline.

### 3. Issues become subitems in proposal (tree structure)
**Rejected:** Overcomplicates data model. Issues should remain flat. Wikilinks provide sufficient relationship.

### 4. Auto-transition issues on proposal creation
**Rejected:** User should decide: mark as consumed, or keep as reference. No forced status change.

## Benefits

- **Fewer steps:** Select → Create → Done (3 clicks vs manual)
- **No friction:** Issues auto-linked bidirectionally
- **Audit trail:** Proposal shows which issues spawned it
- **Discovery:** Contributors see proposal-issue relationships naturally
- **Workflow clarity:** Issues → Proposals → Plans (clear funnel)

## Success Criteria

- [ ] Bulk select 5+ issues in UI (< 500ms load time for 100 issues)
- [ ] Create proposal from selection (< 1s total time)
- [ ] Proposal auto-populated with all issue summaries
- [ ] Bidirectional wikilinks created (proposal ↔ issues)
- [ ] Issue marked with `consumed_by` backlink
- [ ] Status transitions work correctly
- [ ] Zero broken wikilinks after creation
- [ ] Tests cover: selection, creation, linking, status transitions

## Future

- Bulk issue actions from proposal (mark all as resolved when proposal approved)
- Issue "related" suggestions (AI analysis of issue text to suggest groupings)
- Proposal template suggestions (if 5+ issues match a known pattern, suggest template)
- Conflict detection (warn if selecting issues with conflicting requirements)

## Notes

This feature directly supports the [[collaboration flow|feedback-collaboration-flow.md]] pattern: issues are independent chunks that feed into proposals. The UI should make that relationship obvious and effortless.

The feature is non-blocking to other Phase 4 work and can be implemented independently once issues storage is finalized.


*(AI fill-in unavailable — OPENCODE_URL not configured)*

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-07 | AI-improved via Improve | NetYeti |
| 2026-07-07 | AI-improved via Improve | NetYeti |


*(AI fill-in unavailable — OPENCODE_URL not configured)*