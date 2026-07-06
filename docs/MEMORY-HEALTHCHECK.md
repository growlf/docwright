---
title: Memory Management Healthcheck
description: Process for promoting session memories to permanent documentation
status: approved
author: NetYeti
created: 2026-07-06
category: process
---

# Memory Management Healthcheck

## Purpose

Session-local memories (in `.claude/projects/.../memory/`) capture collaborative patterns, feedback, and decisions that emerge during work. Regularly audit these to promote lasting principles into permanent documentation (git, CLAUDE.md, CONTRIBUTING.md, policies).

**Goal:** Enable mutual augmentation by:
1. Making learned patterns available to all future sessions and AI instances
2. Encoding governance in code, not memory
3. Distributing important context into session start/end

## Healthcheck Categories

### 1. **Policy & Philosophy** (→ `policies/core/*.md`)
Principles that govern how work happens. Non-negotiable. Should be documented as approved policies.

**Current examples:**
- `mutual-augmentation-cycle.md` — ✅ PROMOTED to `policies/core/`

**How to identify:** "This is how things *should* work"; guides all future decisions; applies to multiple projects/teams

---

### 2. **Git & Contribution Workflow** (→ `CONTRIBUTING.md`)
Patterns for how code flows through the repo: branching strategy, PR merge approach, release process, dangerous patterns to avoid.

**Current examples:**
- `feedback-git-workflow.md` — Trunk-based branching; should be in CONTRIBUTING.md
- `feedback-merge-prs-as-you-go.md` — PR merge strategy; should be in CONTRIBUTING.md
- `feedback-never-import-cli-to-test.md` — Dangerous pattern; should be in CONTRIBUTING.md
- `feedback-release-is-bdfl-call.md` — Release governance; should be in CONTRIBUTING.md

---

### 3. **Development Practices** (→ `docs/SOPs/*.md` or `CONTRIBUTING.md`)
How to work effectively with DocWright: use the Web UI, invoke skills correctly, handle failure, keep things simple.

**Current examples:**
- `feedback-dogfood-via-ui.md` — Use Web UI for governance; should be in docs/SOPs/
- `feedback-docwright-skills.md` — How to invoke skills; should link from CLAUDE.md or `docs/SKILL-INVOCATION.md`
- `feedback-default-to-simplest.md` — Keep it simple; should be in CLAUDE.md
- `feedback-uncertainty-and-failure.md` — Team culture on failure; should be in CONTRIBUTING.md
- `feedback-act-on-human-decisions.md` — When to act vs. ask; should be in policy or CLAUDE.md

---

### 4. **Collaboration & Teamwork** (→ `CONTRIBUTING.md` or `docs/COLLABORATION.md`)
How humans and AIs work together: workflow, assignment, collision avoidance.

**Current examples:**
- `feedback-collaboration-flow.md` — Proposal → plan → issue flow; should be in CONTRIBUTING.md or docs/

---

### 5. **Session-Specific Context** (→ Keep in memory)
Current state, active work, user setup. Not stable across sessions. Update regularly.

**Current examples:**
- `project-state.md` — Current active plans, branches, env vars
- `user-profile.md` — User's role, preferences, auth
- `identity-setup.md` — Identity configuration
- `csdocs-vault.md` — Specific vault info

---

### 6. **Architecture Decisions** (→ `PROJECT.md` or `docs/DECISIONS/*.md`)
Settled architectural choices that guided the design.

**Current examples:**
- `architecture-decisions.md` — Dispatch invariants, profile config; should link from CLAUDE.md

---

### 7. **Resolved Bugs** (→ Archive or close)
Bugs that have been fixed. No longer actionable.

**Current examples:**
- `bug-version-js-regressive.md` — RESOLVED; can be deleted (info is in git history)

---

### 8. **Migration & Setup** (→ Keep in memory or docs/SETUP.md)
One-time setup steps or migrations. Useful reference but not policy.

**Current examples:**
- `migration-hooks-path.md` — Git hooks setup; useful in docs/SETUP.md

---

## Promotion Checklist (for each session end)

1. **Review new memories created this session**
   - [ ] Read each memory's description
   - [ ] Assess: Is this a one-time lesson or a lasting principle?

2. **For lasting principles:**
   - [ ] Decide: Policy? Contribution guide? SOP?
   - [ ] Write or update target file in git
   - [ ] Link from CLAUDE.md or CONTRIBUTING.md
   - [ ] Update MEMORY.md to reference the permanent location
   - [ ] Delete or archive the memory file

3. **For session-specific context:**
   - [ ] Update `project-state.md` with current work status
   - [ ] Keep in memory for next session

4. **For bugs/resolved issues:**
   - [ ] Verify the fix is in git history
   - [ ] Delete the memory (git is the archive)

## Session Start Integration

At the beginning of each session, automatically:
1. Load this healthcheck
2. Display **what changed in permanent docs** since last session
3. Highlight **new patterns that should be promoted**

Example output:
```
Session start: Checking memory health...

📚 Promoted to permanent docs since last session:
  • mutual-augmentation-cycle → policies/core/

⚠️  Memories ready to promote:
  • feedback-git-workflow → CONTRIBUTING.md (ready)
  • feedback-dogfood-via-ui → docs/SOPs/ (ready)

✓ Session-specific context loaded:
  • 3 active plans (collaboration-issue-model, etc.)
  • Branch: docs/session-end-notes
  • Identity: NetYeti@cluster-llm
```

## Session End Integration

At the end of each session:
1. Run this healthcheck
2. For each new memory, ask: "Should this be permanent?"
3. If yes: Create PR or commit to promote it
4. Update `project-state.md` with final status

## Implementation

### Automation Triggers

**Trigger 1: endsession** — Include healthcheck summary
- List promoted docs
- Flag memories ready for promotion
- Update project state

**Trigger 2: docwright-session-start** — Load healthcheck
- Show what's been promoted since last session
- Load active project state

### Manual Process

Run monthly (or per sprint):
```bash
npm run healthcheck:memories
```

Generates a report of:
- Policies ready to formalize
- Feedback patterns to add to CONTRIBUTING.md
- Resolved bugs to archive
- Session state to update

## Benefits

| When | Benefit |
|---|---|
| **Next session** | Permanent context available immediately |
| **Next developer** | Learns patterns from real work, not from assumptions |
| **Next AI instance** | Can operate with same principles as this session |
| **New team members** | Clear docs on how we work together |
| **Multi-project** | Patterns from one project apply to others |

## Example: Mutual Augmentation Cycle

**Session:** 2026-07-06, collaboration model implementation
**Discovery:** Restriction-based safety (blocking WYSIWYG) is fragile; real safety comes from validation + audit
**Memory created:** `mutual-augmentation-cycle.md`

**Healthcheck decision:** This is a lasting principle
**Promotion:**
- ✅ Created `policies/core/mutual-augmentation-cycle.md`
- ✅ Added principle to CLAUDE.md core philosophy
- ✅ Updated MEMORY.md to reference permanent location

**Result:** All future sessions, projects, and AIs operate with this principle built-in
