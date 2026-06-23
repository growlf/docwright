# Visual Baseline Checks

Run these checks in the browser after any UI change. Each step ≤ 1 minute.

## Chat Panel
- [ ] Panel opens without overlay errors
- [ ] Disconnected state shows OpenCode URL instructions
- [ ] Connected state shows session sidebar with grouped rows
- [ ] New session creates and appears at top of list
- [ ] Typing a message and sending works (messages appear on both sides)
- [ ] Abort button appears during send and cancels the request
- [ ] Settings panel toggles mode/URL with save

## Session Sidebar
- [ ] Sessions grouped by Today / Yesterday / Older
- [ ] Token badges show on rows with usage data
- [ ] ⋮ menu opens Fork / Summarise / Share / Delete
- [ ] Fork creates a new session
- [ ] Delete removes session with confirmation
- [ ] Collapse/expand works

## @-Mention
- [ ] Typing `@` shows file dropdown
- [ ] Typing after `@` filters files
- [ ] Arrow keys navigate, Enter selects
- [ ] Selected file shows as removable chip above input
- [ ] Sending with chips injects context block in prompt
- [ ] Chip ✕ removes without sending

## Model Picker
- [ ] Header shows model button
- [ ] Click opens dropdown grouped by provider
- [ ] Selection changes model (or creates new session)
- [ ] Active model shown on button

## Usage Tracking
- [ ] SSE events populate token/cost in header
- [ ] POST response fallback populates if SSE missed
- [ ] Values show in sidebar rows (compact) and header (full)
- [ ] Clear on disconnect

## Vault-Scoped Sessions
- [ ] New session title prefixed with `[vault-name]`
- [ ] Sidebar shows only vault sessions by default
- [ ] Toggle button shows all sessions
- [ ] Preference persists across page reload
