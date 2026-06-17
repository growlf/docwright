---
name: docwright-project
description: Project registry and vault switching for multi-project DocWright workspaces
distributable: false
---

# DocWright Project Skill

## Registry

Projects are tracked in `.docwright/registry.json` (gitignored). The registry
maps project names to filesystem paths and profiles:

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

## Commands

### `list projects`
Read `.docwright/registry.json` and display each project with its name,
profile, and last session (if any).

### `switch to <project name>`
1. Look up the project in `.docwright/registry.json`
2. Resolve `path` relative to the docwright repo root
3. Read the target project's `opencode.jsonc` for context
4. Update `last_session` in the registry with today's session note
5. The working directory becomes the target project's vault

### `resume <project name>`
Same as `switch to`, then read the project's `last_session` note first.

## Notes

- The docwright repo itself is NOT in the registry — it is the tool.
- Registry is per-checkout (gitignored) so each developer maintains their own.
- Profile in the registry entry determines which docwright profile applies.
