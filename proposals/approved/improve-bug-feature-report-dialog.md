---
title: "Improve bug/feature report dialog - modal UI and feature support"
author: NetYeti
created: 2026-07-07
tags:
  - webui
  - ux
  - bug-reporting
  - feature-requests
approved: true
created_by: "claude@claude-code"
assigned_to: NetYeti
sources:
  - issues/bug-report-bug-button-should-pop-up-a-form.md
  - issues/bug-report-button-should-offer-feature-as-well.md
github_issues:
  - 177
  - 178
_path: proposals/approved/improve-bug-feature-report-dialog
consumed_by: plans/improve-bug-feature-reporting-tool.md
---

# Improve bug/feature report dialog — modal UI and feature support

> **Note (2026-07-09):** This proposal's scope overlaps with — and was ultimately delivered by — Steps 1-2 of `plans/improve-bug-feature-reporting-tool.md` (Wave C), which independently covered the same two source issues. Never got its own plan; superseding rather than duplicating the work.

## Problem

The current "Report Bug" feature has two significant UX gaps:

1. **GitHub #177**: The report form appears at the bottom of the page with no styling or modal presentation, making it nearly invisible and difficult for users to discover or interact with.

2. **GitHub #178**: Users can only report bugs. Feature requests have no dedicated channel, so valuable product feedback gets lost and never feeds into the heatmap demand system.

**Impact**: Users won't bother reporting issues or suggesting features because the UX is poor and feature-only requests have nowhere to go.

## Proposed Solution

Build a proper modal dialog for bug and feature reporting with:

### 1. Modal Dialog Component
- Replace bottom-of-page form with a centered, styled modal popup
- Modal appears when user clicks "Report" button
- Consistent with DocWright UI design (dark theme, proper spacing, typography)
- Close button, keyboard escape support, overlay click to close

### 2. Dual Report Types
Add a radio or toggle to choose between:
- **Bug Report** — report an existing problem
- **Feature Request** — suggest a new capability

Both route to the same submission backend but populate different issue categories.

### 3. Form Fields
**Both types:**
- Title (required)
- Description (required)
- Category tag (auto-filled if coming from specific page context)
- URL/Path (auto-fill from current location)

**Bug reports only:**
- Severity (critical, high, medium, low)
- Steps to reproduce (optional)

**Feature requests only:**
- Problem it solves (optional)

### 4. Submission & Feedback
- Show success message with issue #
- Display "Thanks for the feedback!" message
- Link to created issue (GitHub or local DocWright issue)
- Allow user to immediately close and continue

### 5. Heatmap Integration
- Feature requests feed into the same heatmap + demand-count system as bugs
- "Feature" category visible in Most Reported heatmap (currently only bugs)
- Frequent requests naturally surface as high-demand items

## Alternatives Considered

### 1. Separate buttons for Bug / Feature
**Rejected**: Clutters UI with two buttons. Single "Report" with type chooser inside modal is cleaner.

### 2. Feature requests go to GitHub Discussions only
**Rejected**: Won't feed the heatmap demand system or get visibility in local vault. Need to track locally.

### 3. Keep bottom-of-page form, just style it better
**Rejected**: Users won't notice it regardless of styling. Modal is the UX standard for contextual actions.

## Implementation Notes

- Reuse existing form logic but wrap it in a modal component
- Modal should be globally accessible (e.g., footer button or Cmd+K quick action)
- Issue category should auto-detect from page context when possible
- Success message should show link to created issue for immediate feedback

## Testing

- [ ] Modal opens from "Report" button
- [ ] Modal closes on overlay click, close button, and Escape key
- [ ] Bug and Feature type selection works
- [ ] Form validation enforces required fields
- [ ] Bug report creates `category: bug` issue
- [ ] Feature request creates `category: feature` issue
- [ ] Both types appear in heatmap
- [ ] Demand count increments for duplicate reports
- [ ] Success message displays with issue link

## Success Criteria

- Users can report bugs via an easy-to-find modal
- Users can suggest features with the same ease
- Both types contribute to heatmap visibility
- Modal is polished and matches app design language
- Closes GitHub issues #177 and #178

## Future

- AI pre-submission check: "Does a similar report already exist?" with dedup suggestions
- Mobile-optimized modal variant (fullscreen on small screens)
- Integration with Forgejo issues for upstream tracking
- Badge on Report button showing # of unaddressed reports
