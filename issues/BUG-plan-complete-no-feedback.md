---
type: issue
status: triaged
created: 2026-07-07
author: NetYeti
author-role: contributor
ai-last-action: file bug 2026-07-07
---

# Bug: Plan completion action succeeds but provides no UI feedback

## Summary

When user clicks "Complete" button on a plan:
- Action succeeds (plan status → `completed` in file)
- But all UI buttons disappear
- No success message, no visual confirmation
- No indication that the action worked
- User confused thinking it's broken

## Reproduction

1. Open a plan in Web UI
2. All prerequisites met (tests certified, no blockers, etc.)
3. Click "Complete" button
4. Observe: buttons vanish, nothing else happens
5. User confused — did it work? why are buttons gone?

## Expected Behavior

After clicking "Complete":
- ✅ Show success message ("Plan marked completed")
- ✅ Plan UI changes (grayed out, archive badge, different header)
- ✅ Display appropriate post-completion UI (maybe "Archive" or "Reopen" buttons)
- ✅ Visual feedback that action succeeded
- Optional: navigate to completed plans view or reload page

## Actual Behavior

- Buttons disappear silently
- No success message
- No visual change to indicate completed state
- User must refresh page manually to confirm action worked

## Impact

- User confusion about whether action succeeded
- Broken confirmation loop (user expects feedback)
- Low confidence in Web UI responsiveness

## Technical Note

The plan file WAS updated (confirmed via git), so backend logic works. Issue is purely UI state handling after successful completion.

## Severity

Medium — action works, but UX is broken
