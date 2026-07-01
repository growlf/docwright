# DocWright — docwright-dev Profile AI Instructions

You are an AI assistant working inside the **DocWright project's own development vault**.
This profile governs how DocWright tracks *its own* work, and it draws one line above all:

```
code-issue / bug   →  deliverable is a DIFF, closed by a PR        (issues/)
proposal → plan → policy / decision   →  durable rule/decision     (proposals/, plans/, ...)
```

This profile exists because DocWright dogfoods itself: "the DocWright product" and "the
DocWright project's self-governance" share one repo. Keeping the two grammars distinct is
what stops the tail-chasing. See
`proposals/approved/separate-dev-tracking-milestones-and-beta-channel.md` (GitHub #68).

---

## The sorting test — apply it before creating anything

- **Is the deliverable a diff?** → **code-issue** (a `bug` if it's a defect). Lives in
  `issues/`, closed by a PR.
- **Is the deliverable a durable rule/decision/spec that outlives any single diff?** →
  **governance**: `proposal → plan → policy/decision`.
- **Both?** → create **one of each**, cross-linked: the governance doc owns *what & why*
  (`cross_link:` → the code-issue); the code-issue owns *make it so* (`cross_link:` → the
  governance doc). Never smuggle a policy question inside a bug, or a code fix inside a policy.

Worked examples: `policies/core/code-over-memory.md` is a policy (durable rule); the hook
that enforces it is a code-issue. A pre-commit check that reads a stale file is a pure
code-issue. "Bugs before features" is a pure policy.

---

## Core philosophy — non-negotiable

**Security first. Policy driven. Test verified at every stage.** Every feature is designed
with security as a baseline constraint — never retrofitted. Every behaviour is governed by
policy, not hardcoded logic. Every change ships only after it is verifiable. Apply this
actively: when drafting or reviewing any document, prompt for security implications, ground
the decision in an existing policy, and state how the outcome will be verified before it ships.

**Bugs before features.** Known bugs are resolved before new feature work begins. If you find
a bug while working a feature, file it as a `bug` code-issue and fix it first.
See `policies/core/bugs-before-features.md`.

**Code over memory — automate process enforcement.** When a rule can be enforced by a
pre-commit hook, MCP tool, dispatch validation, UI constraint, or CI check — it must be. Do
not rely on reminders or AI memory. Ask constantly: "Can I enforce this with code?" If yes,
do it or file a code-issue to do so. See `policies/core/code-over-memory.md`.

**Keep good ideas for later.** When work sets something aside, capture it as a deferred
proposal (governance) or a `future`-milestone code-issue before closing. Good ideas not
captured are good ideas lost. See `policies/core/capture-deferred-ideas.md`.

**Multiple perspectives produce better outcomes.** On significant decisions, seek a second
perspective; if you are the primary voice, say so and recommend a human or second-AI review.
See `policies/core/multi-perspective-review.md`.

---

## Lifecycle rules — hard constraints

- You **CANNOT** set `approved: true` on any proposal. Only humans approve, on the sanctioned
  surface (Web UI / a commit they run). This is enforced in code.
- You **CANNOT** set `status: completed` on a plan or `gate_status: approved/waived` on a gate.
- All AI writes that mutate document state must carry `ai-last-action:` stamps.
- A `code-issue`/`bug` is closed by a PR — record it in `closed_by_pr:`; do not mark it
  `resolved` without the merged PR reference.
- Plans require `proposal_source:` pointing to an **approved** proposal before implementation.

---

## Governance tools (via DocWright MCP)

Use the MCP plan tools rather than writing `plans/*.md` directly (the PreToolUse hook blocks
direct writes): `get_plan`, `get_status`, `list_active_plans`, `update_step`,
`update_plan_status`, `append_history`, `set_plan_field`, `write_plan`,
`transition_to_approved`, `transition_to_completed`, `transition_to_canceled`.

**If MCP tools are unavailable:** halt and report — do not fall back to direct file writes.
The governance architecture is fail-closed: no mutation beats an unvalidated one.
