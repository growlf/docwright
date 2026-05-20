---
title: "SOP: Order of Work (Lifecycle)"
category: workflow
created: "2026-05-19"
author: "DocWright"
tags: [workflow, lifecycle, proposals, plans, docs, assignment, documentation, duplicates]
reviewed_by: ""
status: approved
---

# SOP: Order of Work (Lifecycle)

## Purpose
Define the mandatory workflow for all changes, ensuring traceability, review, and documentation.

## The Lifecycle (MANDATORY)

```
proposals/           →  proposals/approved/  →  plans/  ─→  plans/completed/  →  docs/
(approved: false)       (approved: true)        (exec)     ↘  plans/completed/  (canceled, no docs)
```

**Key Rules:**
- **Proposals:** Move to `proposals/approved/` when human sets `approved: true`
- **Plans:** Stay in `plans/` with `status: approved` (human sets this)
- **Assigned to:** `assigned_to` field can include GitHub users OR AI agents
- **Completed:** When plan is fully executed, agent sets `status: completed` and **moves file to `plans/completed/`**
- **Canceled:** When plan is no longer needed, agent sets `status: canceled`, adds `canceled_date` + `cancellation_reason`, and **moves file to `plans/completed/`**
- **Documentation:** Agent generates readable docs/SOPs in `docs/` from completed plans (canceled plans produce NO docs)

## Step 1: Proposal (`proposals/`)
**Who:** Anyone (human or agent)
**Action:**
- **MANDATORY:** Run duplicate detection check — search proposals/, proposals/approved/, plans/, plans/completed/, docs/, docs/SOPs/
- Create Markdown file with descriptive name
- Add frontmatter with `approved: false`
- Describe the problem, proposed solution and expected outcomes
- Set `author`, `created`, `tags`
- Add `related_to`, `depends_on`, `blocks` fields if applicable

**Duplicate Check (BEFORE Creation):**
1. Search `proposals/`, `proposals/approved/`, `plans/`, `plans/completed/`, `docs/`, `docs/SOPs/`
2. If duplicate found: Alert user, offer merge/carve options
3. If partial overlap: Carve down to patch, add `depends_on` field

**Example:**
```yaml
---
title: "Monitor Network Bandwidth"
author: "Your Name"
created: "2026-05-19"
tags: [network, monitoring]
approved: false
priority:
related_to: []
depends_on: []
blocks: []
---
```

**Rule:** No work starts without a proposal. Duplicate check required before creation.

## Step 2: Review & Approval (`proposals/approved/`)
**Who:** **Human only** (designated reviewer — **NEVER the agent**)
**Action:**
- Review proposal
- **Human checks the `approved` box** (sets `approved: true`) — **agents are FORBIDDEN from checking this box**
- **Human sets `priority`** (1-5, where 1 is highest)
- Agent moves file to `proposals/approved/`
- Agent creates corresponding plan in `plans/`

**Rule:** **Only humans can approve proposals. Agents must never set `approved: true` on their own.**

## Step 3: Planning (`plans/`)
**Who:** Agent (with human oversight)
**Action:**
- Create plan file referencing `proposal_source`
- Set `status: proposal` initially
- Detail phases, risks, implementation steps
- Human sets `status: approved` + `reviewed_by` + `reviewed_date`
- Set `priority` matching approved proposal

**Frontmatter:**
```yaml
---
title: "Plan Title"
status: proposal  # Human changes to "approved" when ready
author: "Author Name"
created: "YYYY-MM-DD"
tags: [tag1, tag2]
proposal_source: "proposals/approved/original-proposal.md"
priority: 3
automated: off  # off | guided | full — see Plan Modes below
waiting_reason:  # Populated when status = waiting-for-user
reviewed_by:
reviewed_date:
---
```

**Plan Modes:**
- **`automated: off` (default)** → Mentorship mode — human carries out tasks, LLM provides SOP compliance checks and safety warnings
- **`automated: guided`** → LLM drafts, edits, and stages lifecycle files; human reviews and approves — LLM cannot set `approved: true`
- **`automated: full`** → LLM executes autonomously, pauses at decision points (`status: waiting-for-user`), resumes when human updates status

**Rule:** No execution until `status: approved` or `status: in-progress`.

## Step 3.5: Scenario Synthesis (`plans/`) — MANDATORY for scripts/automation
**Who:** Agent (with human oversight)
**Action:**
- If plan involves scripts, templates, automation, or file modifications:
  - **MANDATORY:** Create a synthetic test scenario
  - Test against temp directories, mock data, or dry-run modes — NEVER live files
  - Document test method, target, and results in the plan
  - Verify output correctness before proceeding
- For plans that don't involve code/scripts (e.g., config changes, documentation-only):
  - This step may be skipped with a note explaining why

**Rule:** NO script or automation may touch real content without passing a synthetic test run first.

## Step 4: Execution (`plans/`)
**Who:** Agent (via auto-runner or interactive)
**Execution Modes:**
- **Full Automation (`automated: full`):** LLM picks up plan automatically, executes autonomously, pauses at decision points requiring human input (`status: waiting-for-user`)
- **Guided Mode (`automated: guided`):** LLM drafts, edits, and stages lifecycle files; human reviews and approves; LLM cannot set `approved: true`
- **Mentorship Mode (`automated: off`, default):** Human carries out tasks their own way, LLM provides SOP compliance checks, safety warnings, and suggestions

**Action:**
- Set `status: in-progress`
- Execute phases in order
- Update plan with progress notes
- Commit changes to git with descriptive messages
- Handle errors, document deviations
- For automated mode: pause at decision points by setting `status: waiting-for-user` with `waiting_reason`

**Rule:** Follow plan phases; document all changes.

## Step 5: Completion (`plans/completed/`)
**Who:** Agent
**Action:**
- Verify all phases complete
- Set `status: completed` in plan frontmatter
- **Move plan file to `plans/completed/`** (mandatory — not just changing status)
- Generate readable documentation/SOPs in `docs/`

**Rule:** No plan stays in `plans/` after completion — must be moved to `plans/completed/`.

## Step 6: Documentation (`docs/`)
**Who:** Agent
**Action:**
- Create final documentation with `status: completed`
- Add `completed_date` and `reviewed_by`
- Link from relevant SOPs or README sections

**Rule:** All completed work must have corresponding docs.

## Step 5.5: Cancellation (Alternative to Step 5)
**Who:** Agent or human
**Trigger:** Plan is no longer needed (superseded, done elsewhere, scope changed, decision to not proceed)

**Action:**
- Set `status: canceled` in plan frontmatter
- Add `canceled_date: "YYYY-MM-DD"`
- Add `cancellation_reason` explaining why
- **Move file to `plans/completed/`** (same final directory as completed plans)
- Do NOT generate documentation

**Valid reasons for cancellation:**
- Work done in another system outside this repo
- Scope change makes the plan obsolete
- Superseded by another plan
- Decision to not proceed

**Example:**
```yaml
---
title: "Example Plan"
status: canceled
canceled_date: "2026-05-19"
cancellation_reason: "Work done in another system outside this repo"
---
```

**Rule:** Canceled plans go to the same `plans/completed/` directory, but produce NO documentation. The proposal stays in place (no action needed).

## Scheduled/Recurring Tasks (`scheduled/`)
For recurring tasks (health checks, audits):
- Place in `scheduled/` with cron-style `schedule` field
- Runner script picks these up independently
- Example: `schedule: "0 3 * * *"` (daily at 3am)

## Enforcement
- **Pre-commit hook** validates frontmatter integrity AND blocks unresolved template variables in `docs/` and `plans/`
- **Scenario synthesis** is mandatory for plans involving scripts/automation
- **One-off tasks** that bypass `plans/` are rejected

## Documentation Standards

### File Naming
- **Format:** `kebab-case.md` (lowercase, hyphens, no spaces)
- **Proposals:** Descriptive name matching the idea
- **Plans:** Same as proposal source
- **Docs:** Descriptive final name

### Content Standards

| Document | Required Elements |
|----------|-----------------|
| Proposal | Problem statement, proposed solution, expected outcomes, tags |
| Plan | Overview, current state, phases, risks, implementation order |
| Completed Doc | Problem solved, implementation completed, how to use, integration |
| SOP | Purpose, scope, standards, examples, enforcement |

### Secrets in Documentation
- **NEVER** include plaintext passwords, API tokens, or private keys
- **DO** reference your secrets vault: `Bitwarden: <item-name>`
- **DO** use placeholders: `<vaultwarden:service-name>`

## Member Assignment

### Field Definitions
- **`created_by`:** GitHub username or identity, immutable, auto-set on creation (from `.env` or git config), agents append `@$(hostname)`
- **`assigned_to`:** YAML list of usernames, `[]` = anyone can pick up, only humans assign members

### Assignment Rules
| State | Rule |
|-------|------|
| Proposal created | `created_by` auto-set, `assigned_to` defaults to `[]` |
| Proposal approved | Move to `proposals/approved/`, warn if `assigned_to` empty |
| Plan ready to execute | `assigned_to` MUST be non-empty (blocked by pre-commit if empty) |
| Plan assigned to others | Agent skips the plan |
| Agent self-assignment | BLOCKED (agent rule violation) |

## Git Commit Standards

See the docwright-git skill (`.opencode/skills/docwright-git/SKILL.md`) and `commit-format` rule (`.opencode/rules/commit-format.md`).

**Format:** `<type>: <description>`
**Valid types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
**Atomic commits:** One logical change per commit

## Proposal Duplicate Detection

### Mandatory Pre-Creation Check
Before creating any proposal, search ALL of:
1. Active Proposals (`proposals/*.md`, `proposals/approved/*.md`)
2. Active Plans (`plans/*.md`)
3. Completed Plans (`plans/completed/*.md`)
4. Documentation (`docs/**/*.md`)
5. SOPs (`docs/SOPs/*.md`)

### Analysis
| Finding | Action |
|---------|--------|
| Exact duplicate exists | Alert user, redirect to existing. Do NOT create. |
| Partially implemented | Offer: (a) Merge into existing plan, or (b) Carve down to patch with `depends_on` |
| Related but distinct | Proceed with new proposal, add `related_to` linking to existing work |
| No overlap found | Proceed with standard creation |

### Overlap Handling
- **Merge:** If overlaps with active plan, merge into existing plan instead of creating new
- **Carve:** If subset of larger effort, reduce scope, add `depends_on: "plans/existing-plan.md"`
- **Foundation:** If must complete before existing work, add `blocks: ["plans/existing-plan.md"]`

## Agent Instructions

<agent-instructions mode="subagent" triggers="lifecycle,plan,proposal,workflow">

### Rules
1. Proposals must have `approved: false` initially — only humans set `approved: true`
2. Proposals cannot move to `proposals/approved/` unless `assigned_to` is non-empty
3. Plans cannot execute unless `status: approved|in-progress` AND `assigned_to` non-empty
4. Completed plans move to `plans/completed/` AND generate docs in `docs/`
5. Canceled plans move to `plans/completed/` AND produce NO docs
6. Agents must NEVER set `approved: true` on proposals

### Actions
- `proposal.approved=true + assigned_to non-empty` → move to approved/, create plan
- `plan fully implemented` → status=completed, move to completed/, generate docs
- `plan obsolete` → status=canceled, canceled_date, cancellation_reason, move to completed/
- `new proposal idea` → run duplicate check before creating (search proposals/, plans/, docs/)
- `plan involves scripts` → require scenario_synthesis before execution

</agent-instructions>
