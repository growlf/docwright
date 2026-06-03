# Rule: Lifecycle Gate — What Requires Human Authorization

This rule defines the lifecycle transitions that ONLY a human may perform
and what agents may do without asking.

## Human-only actions (NEVER do these autonomously)

| Action | Why |
|--------|-----|
| Set `approved: true` on a proposal | Approval is a human governance decision |
| Move a file to `proposals/approved/` | Follows from approval — human must do both |
| Set `status: approved` on a plan | Plan approval is a human commitment |
| Commit with `HUMAN_APPROVED=1` | That env var asserts human intent — agents must not set it |

If a human says "approve this" in conversation, respond:
> "I can't set approved: true — that's a human-only action. Please edit the
> frontmatter yourself and I'll commit the surrounding changes."

## Agent-permitted lifecycle actions

| Action | Condition |
|--------|-----------|
| Set `status: in-progress` on a plan | Plan already has `status: approved` from a human |
| Set `status: completed` on a plan | Implementation is verifiably complete; set `completed_date` |
| Set `status: canceled` + `canceled_date` + `cancellation_reason` | Human confirms cancellation |
| Move plan to `plans/completed/` | Only after status is completed or canceled |
| Generate `docs/` from a completed plan | Standard close-out step |
| Create proposals (`approved: false`) | Always allowed — proposals are ideas, not commitments |

## Checking your context before acting

Before any lifecycle mutation, run:

```bash
node scripts/lifecycle-gate.js --status
```

If no active approved plan is shown, STOP and ask the human to create or
approve one before proceeding.

## Bypass procedure

If a lifecycle check is failing and a human explicitly authorizes an override:

```bash
HUMAN_APPROVED=1 git commit -m "type: description"
```

Only set `HUMAN_APPROVED=1` when a human has explicitly told you to bypass
the check in this conversation. Document the reason in the commit message.
