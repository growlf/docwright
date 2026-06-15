# Profile Contribution Architecture — Design Notes

Design Q&A from early-phase session exploring how to make profiles genuinely
modular so that contributors can add tools, skills, and modules per profile.
The gap analysis below informed the Phase 4 profile engine plan.

---

## Question

How do we structure things so that creating (and contributing) tools, skills,
and modular capabilities is easy for each profile? Profiles focus usage cycles
and automatically suggest modules, plugins, and skills for their purpose.
Example profiles: "Project Management", "Organizational Policies and Audits".

---

## TL;DR Up Front

The current structure is **mostly right**, but there are gaps that will cause
pain before profiles can be genuinely modular with community contributions.
The core issue is that **profiles currently own their structure implicitly** —
there is no formal contract for what a module/skill/tool must provide to be
pluggable into a profile. That contract needs to exist before contributors arrive.

---

## What's Working Well

The `src/profiles/<profile>/` pattern is solid. Directory-per-profile is the
right call. The MCP server as the enforcement layer (not git hooks) is the
right architectural choice — module logic can be validated at runtime, not
just at commit time. The `opencode.jsonc` skills path and the `AGENTS.md`
skills/subagents table are good conventions.

---

## What Needs to Change (or be Added)

### 1. No profile manifest / contract yet

A profile needs to declare itself. A `profile.yaml` at the profile root:

```yaml
id: project-management
name: Project Management
version: 0.1.0
description: Focused workflow for tracking projects from proposal to delivery
author: growlf
requires:
  modules: []
  mcp_tools: [transition_to_approved, transition_to_completed]
suggests:
  modules: [github-issues-sync, gantt-export]
  skills: [docwright-lifecycle, docwright-git]
states:
  - proposal
  - approved
  - in-progress
  - completed
  - canceled
```

The `suggests` block is where the "auto-suggest modules" behavior lives. The
MCP server reads this on session start and can surface what is available.

### 2. No module/plugin contract exists

Skills in `.opencode/skills/` are flat markdown — good for context injection,
but no standard exists for what a _module_ provides beyond that. A layered
concept is needed:

- **Skill** — pure context injection (markdown). Already works.
- **Module** — a skill plus optionally: extra MCP tools, templates,
  frontmatter validators, and rules. A module is a directory:

```
modules/github-issues-sync/
  module.yaml          # manifest: id, version, provides, profile_compat
  skill.md             # injected context (optional)
  templates/           # extra templates this module adds (optional)
  mcp_tools.ts         # additional MCP tool implementations (optional)
  rules/               # additional frontmatter or commit rules (optional)
```

The `module.yaml` manifest is what the MCP server and install tooling reads.

### 3. MCP server has no profile/module awareness yet

For profiles to suggest modules and for modules to contribute tools, the MCP
server needs:

- `list_active_profile()` — detect which profile is active
- `list_suggested_modules(profile_id)` — reads `profile.yaml:suggests`
- `activate_module(module_id)` — wires rules, registers tool paths

### 4. Profile activation is implicit

No "which profile am I currently in?" signal exists. Options: a
`.docwright/active` file, or a `profile:` key in `opencode.jsonc` merged from
`.env` or a local override.

### 5. AGENTS.md skills table is manually maintained

As external contributors add modules, the table will drift. It should be
generated from installed module manifests — the table should be a _view_ of
what is installed, not the source of truth. (`npm run sync:skills` partially
addresses this for built-in skills.)

---

## Suggested Directory Layout

```
src/profiles/
  doc-lifecycle/
    profile.yaml        # NEW: manifest
    profile.json        # existing
    templates/
  project-management/
    profile.yaml
    templates/
modules/                # NEW: installable/contributed modules
  github-issues-sync/
    module.yaml
    skill.md
    mcp_tools.ts
  gantt-export/
    module.yaml
    templates/
```

This separates **profiles** (workflow shape) from **modules** (pluggable
capabilities), which is the composability goal. A "Project Management" profile
suggests `github-issues-sync` and `gantt-export`; an "Org Policies" profile
suggests `org-policies` and `compliance-checklist`.

---

## Contributor Experience

With manifests, the contribution story is simple: fork the repo, create
`modules/<your-module>/module.yaml`, follow the schema, submit a PR. The MCP
server validates the manifest on load.

A `docwright validate-module <path>` script early in the process would catch
issues before contributors have to debug why their module is not being picked up.

---

## What Does NOT Need to Change

The lifecycle state machine, the pre-commit/MCP enforcement split, the
`AGENTS.md` pattern, and the `opencode.jsonc` skills path structure are all
sound. The extensibility layer builds on top of a solid base.

The highest-value first step: write `profile.yaml` for the existing profiles
and add `suggests` blocks — that immediately unlocks the auto-suggest behavior,
even before any external modules exist.
