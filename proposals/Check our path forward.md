
## Question:

tell me if I need to change how I am doing things if I want to start creating (and make it easy for others to allso create) tools, skills, etc to add modular capabilities to this project for the various "profiles" that it will be eventually implementing?  Profiles will be used to focus usage cycles and automaticly suggest modules, plugins, skills, etc for the purpose of the profile. An example profile might be "Project management", anothr might be "Organizational Policies and Audits".

### TL;DR Up Front

Your current structure is **mostly right** for what you're building, but there are a few gaps that will cause pain as soon as you try to make profiles genuinely modular with community-contributed capabilities. The core issue is that **profiles currently own their structure implicitly** — there's no formal contract for what a module/skill/tool needs to provide to be "pluggable" into a profile. You'll want to add that before contributors show up.

---

### What's Working Well

The `.docworkbench/<profile>/` pattern is solid. Directory-per-profile is the right call. The MCP server as the enforcement layer (not git hooks) is the right architectural choice — it means module logic can be validated at runtime, not just at commit time. The `opencode.jsonc` skills path and the `AGENTS.md` skills/subagents table are good conventions.

---

### What Needs to Change (or be Added)

**1. No profile manifest / contract yet**

Right now a profile is just a directory with some state definitions and templates inside. That's fine for two built-in profiles, but for community contribution you need each profile to declare itself. Something like a `profile.yaml` at `.docworkbench/<profile>/profile.yaml`:

yaml

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

The `suggests` block is where the "auto-suggest modules for this profile" behavior lives. The MCP server reads this on session start and can tell the agent (or the user) what's available.

**2. No module/plugin contract exists**

Skills in `.opencode/skills/` right now are flat markdown files — good for agent context injection, but there's no standard for what a _module_ provides beyond that. You need a layered concept:

- **Skill** — pure context injection (markdown). Already works.
- **Module** — a skill _plus_ optionally: extra MCP tools, extra templates, extra frontmatter validators, extra rules. A module is a directory, not a file:

```
.docworkbench/modules/github-issues-sync/
  module.yaml          # manifest: id, version, provides, profile_compat
  skill.md             # injected context (optional)
  templates/           # extra templates this module adds (optional)
  mcp_tools.py         # additional MCP tool implementations (optional)
  rules/               # additional frontmatter or commit rules (optional)
```

The `module.yaml` is the key — it's what the MCP server and any install tooling reads to wire things up.

**3. The MCP server has no profile/module awareness yet**

`scripts/mcp-server.py` (based on what I can see) is currently focused on lifecycle transitions. For profiles to suggest modules and for modules to contribute tools, the MCP server needs a few more capabilities:

- `list_active_profile()` — detect which profile is active (could be a `.docworkbench/active` file or read from a frontmatter convention)
- `list_suggested_modules(profile_id)` — reads `profile.yaml:suggests` and returns what's available vs. installed
- `activate_module(module_id)` — performs the wiring (copies rules into place, registers MCP tool paths, etc.)

This doesn't need to be complex — even just reading the manifests and returning structured data is enough for the agent to reason about.

**4. Profile activation is implicit**

There's no concept of "which profile am I currently in?" right now. You'll want a lightweight signal — either a `.docworkbench/active` symlink pointing to the active profile directory, or a `profile: project-management` key in `opencode.jsonc` (merged per-project via the `.env` or a local override). The agent and MCP server both need this to scope suggestions and enforcement correctly.

**5. The AGENTS.md skills table is manually maintained**

As soon as external contributors add modules, that table will drift. It should be generated from the installed module manifests, not hand-edited. A script or MCP tool that reads all `module.yaml` files and outputs the table would close this loop — or at least make the table a _view_ of what's installed rather than the source of truth.

---

### Suggested Directory Layout Change

```
.docworkbench/
  active -> project-management/   # symlink or file naming active profile
  profiles/
    doc-lifecycle/
      profile.yaml                # NEW: manifest
      states.yaml                 # (existing state defs, just moved/formalized)
      templates/
    project-management/
      profile.yaml
      templates/
  modules/                        # NEW: installable/contributed modules
    github-issues-sync/
      module.yaml
      skill.md
      mcp_tools.py
    gantt-export/
      module.yaml
      templates/
    org-policies/
      module.yaml
      skill.md
      rules/
        policy-frontmatter.md
```

This separates **profiles** (the workflow shape) from **modules** (pluggable capabilities), which is exactly the composability you're after. A "Project Management" profile might suggest the `github-issues-sync` and `gantt-export` modules. An "Organizational Policies and Audits" profile might suggest `org-policies` and `compliance-checklist`.

---

### For Contributor Experience

Once you have manifests, the contribution story becomes dead simple: fork the repo, create `.docworkbench/modules/<your-module>/module.yaml`, follow the schema, submit a PR. The MCP server validates the manifest on load. No magic, no framework, just directories and YAML.

You might also want a `docwright validate-module <path>` script early — before contributors have to figure out why their module isn't being picked up.

---

### What You Don't Need to Change

The lifecycle state machine, the pre-commit/MCP enforcement split, the `AGENTS.md` pattern, the flat `opencode.jsonc` with skills paths — all of that is sound and doesn't need rework. You're building the extensibility layer on top of a solid base.

The biggest single win right now is probably writing `profile.yaml` for your two existing profiles and adding the `suggests` block — that immediately unlocks the "auto-suggest modules" behavior you described, even before any modules exist.