---
title: Plugin System — Extensible Module Architecture
status: in-progress
author: NetYeti
author-role: operator
created: 2026-06-25
type: plan
tags:
  - plugin-system
  - phase-4
  - architecture
  - extensibility
priority: high
mode: mentor
assigned_to: NetYeti
depends_on:
  - phase-4-profile-acl-ai.md
scenario_synthesis: false
_path: plans/plugin-system.md
proposal_source: profile-contribution-architecture.md
phase: 4
total_steps: 14
completed_steps: 12
github_epic:
automated: full
tests_defined: false
gate_note: "Changed files are untestable types: plans/plugin-system.md"
---

# Plugin System — Extensible Module Architecture

## Overview

Add a first-class plugin/module system to DocWright that allows external projects
to contribute new UI views, API routes, and MCP tools without being compiled into
DocWright's core bundle.

**Driving use case:** `cs-erp-images` (Cascade STEAM's Frappe Docker image pipeline)
needs an Image Generator form and a Customer Deployment form. Rather than building
a standalone web app, it will be Module 0 — the first DocWright plugin. The
architecture it proves becomes the standard for all future plugins.

**Design invariants:**
- DocWright's core bundle NEVER includes plugin code
- Plugins ship pre-built bundles (server.js + client/bundle.js)
- Plugins run in DocWright's DOM — same CSS variables, same origin, same REST API access
- A plugin crash must not crash DocWright
- Plugin contract is `plugin.json` + two optional entrypoints

**Cross-reference:** `cs-erp-images` plan at
`bms-ai-cluster/plans/cs-erp-images-docker-pipeline.md` — Phase 3 is the
cs-erp-images plugin implementation, depending on this plan.

---

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| **Phase 1 — Core Infrastructure** | | | |
| 1 | `plugin.json` schema | Define `PluginManifest` TypeScript interface + JSON schema. Fields: `apiVersion`, `name`, `displayName`, `version`, `description`, `icon`, `author?`, `serverEntrypoint`, `clientEntrypoint`, `clientStylesheet?` | ✅ Done |
| 2 | `src/webui/src/lib/server/plugins.ts` | `scanPlugins()` scans `${DOCWRIGHT_VAULT_ROOT}/plugins/*/plugin.json`. `findPlugin(name)` returns a single loaded plugin. Both are pure Node.js FS operations — no SvelteKit deps. | ✅ Done |
| 3 | `/api/plugins` route | `GET` returns JSON array of active plugin metadata (name, displayName, icon, version, description). No auth required — metadata only. | ✅ Done |
| 4 | `/api/plugin/[name]/[...path]` catch-all | Serves static plugin files (bundle.js, style.css) from `plugin.dir/path`. Falls through to plugin `server.js` handlers for non-file paths. Path traversal guard enforced. | ✅ Done |
| **Phase 2 — UI Integration** | | | |
| 5 | `/plugin/[name]/+page.svelte` | Full-page plugin view: loads `client/bundle.js` into `#plugin-root` div. Shows placeholder if bundle not built. Applies `client/style.css` if present. Plugin script mounts itself to `#plugin-root`. | ✅ Done |
| 6 | Activity bar dynamic icons | `+layout.svelte` fetches `/api/plugins` on mount, renders one activity bar button per plugin using its `icon` emoji. Clicking navigates to `/plugin/{name}`. | ✅ Done |
| 7 | Module 0 scaffold — cs-erp-images | `plugins/erp-images/plugin.json`, stub `server.js`, stub `client/bundle.js` in cs-erp-images repo. Verifies end-to-end: DocWright shows 🐳 icon, navigates to plugin page, renders placeholder. | ✅ Done |
| **Phase 3 — Plugin Hardening** | | | |
| 8 | Error boundary | Plugin page wraps bundle execution in try/catch. Plugin JS errors show an error panel without crashing DocWright layout. Console errors are scoped to plugin name prefix. | ✅ Done |
| 9 | Plugin manifest validation | `scanPlugins()` validates required fields and `apiVersion` compatibility. Logs warnings for unknown fields (forward-compat). Invalid manifests are skipped, not fatal. | ✅ Done |
| 10 | Plugin hot-reload | File watcher on `plugins/*/` triggers re-scan. Activity bar updates without full page reload. Useful during plugin development. | ✅ Done |
| 11 | DocWright JS bridge | `window.__docwright` object injected on plugin pages: `{ toast, notify, apiBase, vaultRoot }`. Plugins call `window.__docwright.toast('message')` instead of direct DOM manipulation. | ✅ Done |
| **Phase 4 — Module 0 Full Implementation** | | | |
| 12 | cs-erp-images Image Generator UI | Full SvelteKit app compiled to `client/bundle.js`. App selector form (reads `/api/plugin/erp-images/api/catalogue`), version calculator, GitHub PR creation flow. | ✅ Done |
| 13 | cs-erp-images Deployment UI | Customer deployment form: image picker (GHCR list), site info, Ansible vars generator, playbook trigger or command display. | ⏳ Pending |
| 14 | Contribution guide | `docs/plugins.md` in DocWright: how to build a plugin, `plugin.json` schema reference, bridge API, bundle build patterns. | ⏳ Pending |

---

## Plugin Contract

A plugin is a directory at `${DOCWRIGHT_VAULT_ROOT}/plugins/<name>/` containing:

```
plugin.json          # required — manifest
server.js            # optional — CJS module; exports { GET, POST, PUT, DELETE }
client/
  bundle.js          # optional — self-contained JS; mounts to document.getElementById('plugin-root')
  style.css          # optional — scoped styles; DocWright CSS variables available
```

**`plugin.json` minimum viable manifest:**
```json
{
  "apiVersion": "1",
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "0.1.0",
  "description": "What this plugin does",
  "icon": "🔌"
}
```

**`server.js` handler signature:**
```javascript
async function GET({ request, subpath }) {
  return Response.json({ ok: true });
}
module.exports = { GET, POST };
```

**`client/bundle.js` mount pattern:**
```javascript
(function() {
  const root = document.getElementById('plugin-root');
  if (!root) return;
  // render UI into root — DocWright CSS variables available on :root
})();
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/webui/src/lib/server/plugins.ts` | Plugin scanner + manifest loader |
| `src/webui/src/routes/api/plugins/+server.ts` | List active plugins |
| `src/webui/src/routes/api/plugin/[name]/[...path]/+server.ts` | Catch-all: static files + server handler dispatch |
| `src/webui/src/routes/plugin/[name]/+page.svelte` | Full-page plugin view |
| `src/webui/src/routes/+layout.svelte` | Dynamic activity bar icons (6-line addition) |

## Testing Plan

### Step Verification

- [ ] Step 1: `plugin.json` schema
- [ ] Step 2: `src/webui/src/lib/server/plugins.ts`
- [ ] Step 3: `/api/plugins` route
- [ ] Step 4: `/api/plugin/[name]/[...path]` catch-all
- [ ] Step 5: `/plugin/[name]/+page.svelte`
- [ ] Step 6: Activity bar dynamic icons
- [ ] Step 7: Module 0 scaffold — cs-erp-images
- [ ] Step 8: Error boundary
- [ ] Step 9: Plugin manifest validation
- [ ] Step 10: Plugin hot-reload
- [ ] Step 11: DocWright JS bridge
- [ ] Step 12: cs-erp-images Image Generator UI
- [ ] Step 13: cs-erp-images Deployment UI
- [ ] Step 14: Contribution guide

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plugin System — Extensible Module Architecture functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows
