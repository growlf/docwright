---
title: Project registry for multi-vault project tracking
author: NetYeti
created: 2026-06-02
tags:
  - core
  - workflow
  - registry
  - multi-repo
approved: true
created_by: NetYeti@phoenix
priority: highest
assigned_to: "NetYeti"
consumed_by: plans/completed/project-registry.md
---

## Problem

DocWright manages its own development and also governs external projects via
separate vaults. Currently there is no way to discover or resume work across
these projects without knowing the filesystem path and profile for each one.

A project registry solves this without violating the "virgin repo" principle:
the docwright repo never commits references to external projects.

## Proposed Solution

Create `.docwright/registry.json` at the docwright repo root, gitignored,
containing a simple index:

```json
{
  "projects": [
    {
      "name": "Example Project",
      "path": "../example-infra",
      "profile": "infra-topology",
      "last_session": "docs/session-notes/session_note_yyyymmdd.md"
    }
  ]
}
```

### Deliverables

1. `.docwright/` directory with `.gitignore` wildcard (`*`)

2. Registry schema and read/write in `src/dispatch/registry.ts`
   - `loadRegistry(root: string): Registry`
   - `listProjects(registry): Project[]`
   - `updateLastSession(root: string, name: string, path: string)`

3. Web UI surface:
   - Project switcher in the sidebar
   - Shows name, profile, last session note link
   - Click to navigate or resume

4. Integration with session workflow:
   - Auto-update `last_session` when resuming a project
   - OpenCode command or config to switch vault context

## Non-goals

- No auto-discovery of vaults
- No git submodules or symlinks
- No shared state between projects (each vault is standalone)

## Future

- Profile-aware project templates for `init project`
- Remote registry sync (optional, post-v1)
