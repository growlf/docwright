# DocWright Plugin Developer Guide

DocWright's plugin system lets external tools extend the shell's left panel and right
panel without modifying DocWright's source. A plugin registers a **View Container** —
a sidebar panel with an activity bar icon — and optionally claims the right panel to
show secondary content.

---

## Table of Contents

1. [Concepts](#concepts)
2. [plugin.json schema](#pluginjson-schema)
3. [Client bundle contract](#client-bundle-contract)
4. [Bridge API reference](#bridge-api-reference)
5. [Right panel claim](#right-panel-claim)
6. [Searchable contract](#searchable-contract)
7. [TypeScript types](#typescript-types)
8. [Lifecycle diagram](#lifecycle-diagram)
9. [Example plugin skeleton](#example-plugin-skeleton)
10. [Development workflow](#development-workflow)
11. [Privilege boundaries](#privilege-boundaries)

---

## Concepts

```
Activity bar
  └─ Your icon (order: 100+)

Left panel (owned entirely by your VC when active)
  ├─ [optional search input — shell-rendered when searchable:true]
  └─ Your mount target (fill this with your UI)

Right panel (optional — you claim it; shell reclaims when you deactivate)
  └─ Your HTML string
```

**View Container (VC):** A JavaScript object with `mount(el)` and `unmount()`. DocWright
calls `mount` with the sidebar DOM element when the user activates your view, and
`unmount` when they switch away.

**Bridge:** `window.__docwright.bridge` — the set of shell methods your plugin may call
(toast, navigate, claimRightPanel, etc.). Populated before your bundle executes.

**Plugin isolation:** Your bundle runs in the same page context as DocWright. Errors
thrown inside `mount()` are caught by DocWright's error boundary — your plugin shows
an error panel instead of crashing the shell.

---

## plugin.json schema

Place `plugin.json` at the root of your plugin directory.

```json
{
  "apiVersion": "1",
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "1.0.0",
  "description": "A short description shown in the plugin list",
  "icon": "🔌",

  "type": "view-container",
  "order": 100,
  "searchable": false,
  "capabilities": [],

  "serverEntrypoint": "server.js",
  "clientEntrypoint": "client/bundle.js",
  "clientStylesheet": "client/style.css"
}
```

### Field reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `apiVersion` | `"1"` | ✅ | — | Must be `"1"`. DocWright rejects unknown versions. |
| `name` | string | ✅ | — | Kebab-case identifier. Must match the directory name. |
| `displayName` | string | ✅ | — | Human-readable name shown in the activity bar tooltip. |
| `version` | string | ✅ | — | SemVer string, e.g. `"1.0.0"`. |
| `description` | string | ✅ | — | One-line description for the plugin list. |
| `icon` | string | ✅ | — | Single emoji shown in the activity bar. |
| `author` | string | — | — | Optional author name or email. |
| `type` | `"view-container"` \| `"tool"` | — | `"view-container"` | Opts into activity bar presence. Use `"tool"` for server-side-only plugins. |
| `order` | integer | — | `100` | Activity bar position. Core views use 10–40. External plugins should use 100+. Lower = higher up. |
| `searchable` | boolean | — | `false` | If `true`, DocWright renders a search input above your panel and calls `vc.onSearch(query)` as the user types. |
| `capabilities` | string[] | — | `[]` | Reserved for future permission gating. Leave empty. |
| `serverEntrypoint` | string | — | `"server.js"` | Server-side entry (API routes, etc.). Optional. |
| `clientEntrypoint` | string | — | `"client/bundle.js"` | Path to your client bundle, relative to the plugin directory. |
| `clientStylesheet` | string | — | `"client/style.css"` | Optional CSS loaded alongside your bundle. |

### Activity bar ordering

```
10  🏛 Governance Engine  (DocWright core)
20  📄 Files              (DocWright core)
25  🔍 Search             (DocWright core)
30  🏷 Tags               (DocWright core)
40  ⎇  Git               (DocWright core)
── divider ──
100+ Your plugin
```

Use order `100` or higher. Plugins are sorted by `order` ascending; ties are broken by
registration order.

---

## Client bundle contract

Your `client/bundle.js` must call `window.__docwright.registerView()` before it returns.
DocWright loads your bundle lazily on the user's first click of your activity bar icon.

```javascript
// client/bundle.js — minimum viable View Container
window.__docwright.registerView('my-plugin', {
  mount(el) {
    // el is the sidebar container — in the DOM, sized, ready to render into.
    el.innerHTML = '<div style="padding:16px;color:#ccc">Hello from my plugin</div>';
  },

  unmount() {
    // Clean up event listeners, timers, framework instances.
  },
});
```

### Full View Container interface

```typescript
interface DWViewContainer {
  mount(el: HTMLElement): void;    // required
  unmount(): void;                 // required

  onSearch?(query: string): void;  // optional — only called when searchable: true
  onActivate?(): void;             // optional — called each time the view becomes active
  onDeactivate?(): void;           // optional — called when the user switches away
}
```

#### `mount(el)`

- `el` is already in the DOM and has a computed height.
- You may render any framework (React, Vue, vanilla JS) by calling its root render method
  with `el` as the target.
- If `mount` throws, DocWright catches it and shows an inline error panel. The shell does
  not crash.

#### `unmount()`

- Always called before `mount` is called again (on re-activation after navigation).
- Always called when DocWright cleans up your VC (page unload, VC switch).
- Call your framework's unmount/destroy equivalent here.

#### `onActivate()` / `onDeactivate()`

- `onActivate` fires after `mount` on the first activation, and each subsequent time the
  user switches back to your view without a page reload.
- `onDeactivate` fires before `unmount` on deactivation. The shell also auto-releases any
  right panel claim you made.

#### `onSearch(query)`

- Only called when `searchable: true` in your `plugin.json`.
- DocWright renders a search `<input>` above your panel. As the user types, `onSearch` is
  called with the current value.
- When the user clears the input, `onSearch('')` is called.
- The search input clears when your VC is deactivated.

---

## Bridge API reference

`window.__docwright.bridge` is available immediately — before and after your bundle loads.

### Toast

```typescript
bridge.toast(message: string, duration?: number): void
```

Shows a transient toast at the bottom-right. `duration` defaults to 4000ms.

```javascript
window.__docwright.bridge.toast('File saved ✓');
window.__docwright.bridge.toast('⚠ Connection lost', 8000);
```

### Notify

```typescript
bridge.notify(opts: DWNotifyOpts): void

interface DWNotifyOpts {
  type: 'info' | 'warning' | 'error' | 'success' | 'drift';
  title: string;
  message: string;
  persistent?: boolean;  // stays until dismissed (default: false)
}
```

Adds a notification banner above the main content area.

```javascript
window.__docwright.bridge.notify({
  type: 'warning',
  title: 'Drift detected',
  message: '3 devices are outside policy bounds',
  persistent: true,
});
```

### Navigate

```typescript
bridge.navigate(path: string): void
bridge.openDocument(vaultPath: string): void
```

`navigate` pushes a SvelteKit route. `openDocument` is a convenience wrapper that strips
the `.md` extension and navigates to the document route.

```javascript
bridge.navigate('/status');
bridge.openDocument('proposals/my-proposal.md');
// equivalent to: bridge.navigate('/proposals/my-proposal')
```

### Constants

```typescript
bridge.apiBase: string    // always '/api'
bridge.vaultRoot: string  // absolute server path to the vault root
bridge.apiVersion: string // '1' — bump on breaking API change
```

Use `bridge.apiBase` for all fetch calls so your plugin works regardless of deployment
path:

```javascript
const res = await fetch(`${window.__docwright.bridge.apiBase}/status`);
const data = await res.json();
```

---

## Right panel claim

Your plugin can replace the standard Properties/Related/Review tabs with arbitrary HTML.

```typescript
bridge.claimRightPanel(html: string, label?: string): void
bridge.releaseRightPanel(): void
```

- **Claim** shows your HTML in the right panel with `label` in the header (default: `"Info"`).
- **Release** restores the standard tabs for the currently open document.
- The shell **auto-releases** when your VC is deactivated — you don't need to release in
  `onDeactivate` unless you want to release earlier.

```javascript
window.__docwright.registerView('erp-images', {
  mount(el) {
    // Render sidebar listing of deployment images
    el.innerHTML = '<ul id="erp-image-list"></ul>';
    loadImages(el.querySelector('#erp-image-list'));
  },

  unmount() {
    window.__docwright.bridge.releaseRightPanel();
  },
});

function showImageDetail(image) {
  window.__docwright.bridge.claimRightPanel(
    `<div class="erp-detail">
       <h3>${image.name}</h3>
       <p>Version: ${image.version}</p>
       <p>Status: ${image.status}</p>
     </div>`,
    'Image Detail'
  );
}
```

### Priority model

The right panel uses a **priority stack**:

1. **VC claim** — your `claimRightPanel` call wins.
2. **Active document** — if no claim, DocWright shows Properties/Related/Review for the
   open document.
3. **Empty** — if no claim and no document, DocWright shows "Open a document".

Your plugin does not need to claim the right panel — only do it if you have a meaningful
secondary view to show.

---

## Searchable contract

When `searchable: true`, DocWright shows a search input above your panel and routes
keystrokes to `onSearch`:

```javascript
window.__docwright.registerView('my-plugin', {
  mount(el) {
    this._list = document.createElement('ul');
    el.appendChild(this._list);
    this._items = ['alpha', 'beta', 'gamma'];
    this._render('');
  },

  unmount() { /* cleanup */ },

  onSearch(query) {
    this._render(query);
  },

  _render(query) {
    const filtered = this._items.filter(i => i.includes(query.toLowerCase()));
    this._list.innerHTML = filtered.map(i => `<li>${i}</li>`).join('');
  },
});
```

The search input is rendered and owned by the shell — you cannot style it. Only the
content of `el` is under your control.

---

## server.js — API routes

If your plugin needs server-side logic, export handler functions from `server.js`
(path configurable via `serverEntrypoint`). DocWright dispatches all requests to
`/api/plugin/<name>/<subpath>` that are not static files.

```javascript
// server.js — CommonJS module
async function GET({ request, subpath }) {
  // subpath = everything after /api/plugin/<name>/
  // e.g. /api/plugin/my-plugin/api/items  →  subpath = "api/items"
  const url = new URL(request.url);
  const sp  = url.searchParams;

  if (subpath === 'api/items') {
    return Response.json([{ id: 1, name: 'Widget' }]);
  }

  return new Response(`not found: ${subpath}`, { status: 404 });
}

async function POST({ request, subpath }) {
  const body = await request.json();
  if (subpath === 'api/items') {
    // ... save body ...
    return Response.json({ ok: true });
  }
  return new Response('Not found', { status: 404 });
}

module.exports = { GET, POST };   // PUT, DELETE, PATCH also supported
```

DocWright enforces path traversal guards on static file serving — requests that
escape the plugin directory are rejected with 403. Your handler receives all other
paths regardless of depth.

### SSE streaming

Return a `ReadableStream` with `Content-Type: text/event-stream` for streaming output
(build logs, deploy progress, live updates):

```javascript
async function GET({ request, subpath }) {
  if (subpath !== 'api/stream') return new Response('not found', { status: 404 });

  const { spawn } = require('child_process');
  const sse      = obj          => `data: ${JSON.stringify(obj)}\n\n`;
  const sseEvent = (event, obj) => `event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`;

  const stream = new ReadableStream({
    start(ctrl) {
      const enc  = s    => ctrl.enqueue(Buffer.from(s));
      const proc = spawn('my-long-running-command', []);
      proc.stdout.on('data', d => enc(sse({ line: d.toString() })));
      proc.stderr.on('data', d => enc(sse({ line: d.toString() })));
      proc.on('close', code => { enc(sseEvent('done', { code })); ctrl.close(); });
      proc.on('error', err  => { enc(sseEvent('error', { message: err.message })); ctrl.close(); });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',   // disable nginx buffering
    },
  });
}
```

Client-side consumption:

```javascript
const es = new EventSource('/api/plugin/my-plugin/api/stream');
es.onmessage = e => {
  const { line } = JSON.parse(e.data);
  logEl.textContent += line;
};
es.addEventListener('done', e => {
  const { code } = JSON.parse(e.data);
  es.close();
  console.log('exited', code);
});
es.addEventListener('error', () => es.close());
```

---

## Hot-reload

DocWright watches `${VAULT_ROOT}/plugins/` via SSE. When any file changes, it
re-fetches `/api/plugins` and updates the activity bar — no server restart needed.

To reload your bundle during development:

1. Save your `client/bundle.js`
2. The activity bar icon refreshes within ~300 ms
3. Click away from and back to your view — `mount(el)` runs with the new code

A hard browser refresh (`Ctrl+Shift+R`) is only needed if the bundle was cached by the
browser's script tag cache.

---

## Error isolation

DocWright's error boundary protects the shell from plugin crashes:

- **Synchronous errors** thrown inside `mount()` or the bundle IIFE are caught via
  `window.addEventListener('error', ...)`, scoped to the plugin's bundle URL.
- **Unhandled promise rejections** attributed to the plugin's bundle path are also caught.
- When an error is caught, DocWright shows an error panel with the message and a
  "Reload plugin" button. The rest of the shell continues to work.
- **Console output** (`error`, `warn`, `log`, `info`) is prefixed with `[plugin:<name>]`
  while the plugin page is active, and restored on navigation away.

Your `server.js` throwing an unhandled exception returns a 500 response to the client.
The DocWright server process is unaffected.

---

## TypeScript types

Copy `src/webui/src/lib/plugin-api.d.ts` into your project for full type coverage:

```typescript
// In your tsconfig.json:
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*", "plugin-api.d.ts"]
}
```

With the type declarations in place, your bundle's TypeScript will be fully checked:

```typescript
// client/src/index.ts
const dw = window.__docwright;  // typed as DWDocwright

dw.registerView('my-plugin', {
  mount(el: HTMLElement) {
    dw.bridge.toast('Mounted!');     // ✓
    dw.bridge.unknownMethod();       // ✗ TypeScript error
  },
  unmount() {},
});
```

---

## Lifecycle diagram

```
User clicks activity bar icon
        │
        ▼
DocWright checks the registerView registry for 'my-plugin'
        │
        ├── Not found → load client/bundle.js
        │                │
        │                └── bundle calls registerView() → registered
        │
        └── Found
                │
                ▼
        ViewContainerMount renders <div id="my-plugin-sidebar-root">
                │
                ▼
        vc.mount(el)  ← your code runs here
         onActivate() ← optional
                │
        [user uses plugin]
                │
        vc.onSearch(q) ← if searchable:true and user types
                │
        [user switches to another view]
                │
                ▼
        vc.onDeactivate() ← optional
        shell auto-releases right panel claim
        vc.unmount()
                │
        [vc.mount(el) will be called again on next activation]
```

---

## Example plugin skeleton

A complete minimal plugin that:
- Lists items fetched from a custom API
- Shows detail in the right panel on click
- Supports search filtering

```
plugins/
└── my-plugin/
    ├── plugin.json
    └── client/
        ├── bundle.js    ← built by your bundler from src/index.ts
        └── style.css    ← optional
```

**`plugin.json`**

```json
{
  "apiVersion": "1",
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "1.0.0",
  "description": "Demonstrates the DocWright plugin API",
  "icon": "🔌",
  "type": "view-container",
  "order": 100,
  "searchable": true,
  "capabilities": []
}
```

**`client/src/index.ts`**

```typescript
/// <reference path="../plugin-api.d.ts" />

interface Item { id: string; name: string; detail: string; }

const dw = window.__docwright;
const api = dw.bridge.apiBase;

let root: HTMLElement | null = null;
let allItems: Item[] = [];
let query = '';

function render() {
  if (!root) return;
  const visible = query
    ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  root.innerHTML = visible.length === 0
    ? `<p style="padding:16px;color:#666">${query ? 'No matches' : 'Loading…'}</p>`
    : `<ul class="mp-list">
        ${visible.map(i => `
          <li class="mp-item" data-id="${i.id}">
            <span class="mp-name">${i.name}</span>
          </li>
        `).join('')}
       </ul>`;

  root.querySelectorAll('.mp-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = allItems.find(i => i.id === (el as HTMLElement).dataset.id);
      if (item) showDetail(item);
    });
  });
}

function showDetail(item: Item) {
  dw.bridge.claimRightPanel(
    `<div style="padding:16px">
       <h3 style="margin:0 0 8px;color:#eee">${item.name}</h3>
       <p style="color:#aaa">${item.detail}</p>
     </div>`,
    item.name
  );
}

async function load() {
  try {
    // Replace with your actual API endpoint
    const res = await fetch(`${api}/registry`);
    const data = await res.json();
    allItems = (data.projects ?? []).map((p: any) => ({
      id: p.name,
      name: p.name,
      detail: `Profile: ${p.profile}`,
    }));
    render();
  } catch {
    if (root) root.innerHTML = '<p style="padding:16px;color:#e44">Load failed</p>';
  }
}

dw.registerView('my-plugin', {
  mount(el: HTMLElement) {
    root = el;
    load();
  },

  unmount() {
    root = null;
    dw.bridge.releaseRightPanel();
  },

  onSearch(q: string) {
    query = q;
    render();
  },

  onDeactivate() {
    query = '';
  },
});
```

**`client/style.css`** (optional)

```css
.mp-list { list-style: none; margin: 0; padding: 0; }
.mp-item {
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
  color: #ccc;
  border-bottom: 1px solid #222;
}
.mp-item:hover { background: #1a1a1a; color: #fff; }
.mp-name { display: block; }
```

---

## Development workflow

### 1. Create your plugin directory

```bash
mkdir -p plugins/my-plugin/client
cd plugins/my-plugin
```

Copy `src/webui/src/lib/plugin-api.d.ts` into your project root.

### 2. Build your bundle

DocWright expects a single `client/bundle.js`. Any bundler works:

```bash
# esbuild (recommended — fast, zero config)
npx esbuild client/src/index.ts --bundle --outfile=client/bundle.js --format=iife

# Vite (library mode)
# vite.config.ts: build.lib.entry = 'src/index.ts', formats: ['iife']
```

The bundle must be an **IIFE** (Immediately Invoked Function Expression) so it executes
on load and calls `registerView` synchronously or before the event loop yields.

### 3. Install the plugin

Place your plugin directory inside the vault's `plugins/` folder:

```
your-vault/
└── plugins/
    └── my-plugin/
        ├── plugin.json
        └── client/
            └── bundle.js
```

DocWright scans `plugins/` on startup and on the `/api/plugins` endpoint. No restart
needed if the vault is running — your bundle will be loaded the next time a user clicks
your activity bar icon.

### 4. Test in the browser

1. Open DocWright at `http://localhost:5173`
2. Your icon appears in the activity bar (after the core views)
3. Click it — DocWright loads `client/bundle.js`, calls `registerView`, then `mount(el)`
4. Check the browser console for errors

### 5. Iterate

```bash
# Watch mode — rebuild on every save
npx esbuild client/src/index.ts --bundle --outfile=client/bundle.js \
  --format=iife --watch
```

DocWright reloads your bundle on each activity bar click. Hard-refresh (`Ctrl+Shift+R`)
to clear the cached script tag if the bundle has changed.

---

## Privilege boundaries

### What external plugins may do

- Call any `bridge.*` method
- Render any HTML/CSS inside the mount element
- Fetch any URL (including `bridge.apiBase` endpoints)
- Call `bridge.navigate()` and `bridge.openDocument()`
- Claim and release the right panel

### What external plugins may NOT do

- Import from DocWright's source tree (`$lib/`, `$app/`)
- Use `bridge.emit()` — this is for core plugins only (source tree only)
- Write directly to `window.__dw_plugins` — use `registerView()` only

### Core plugins vs external plugins

DocWright's own bundled view containers (Governance Engine, Files, Git, Tags, Search) are
compiled into DocWright's bundle, not loaded as external scripts. They may import from
`$lib/` and use internal stores. This distinction is enforced by source tree access, not
by a runtime gate — external plugins simply don't have the import paths.

---

## API version history

| Version | Changes |
|---------|---------|
| `1` (current) | Initial stable API: `registerView`, bridge methods, `plugin.json` v1 schema with `order`/`searchable`/`capabilities`/`type` fields |

When DocWright increments `bridge.apiVersion`, it will document what changed and what
the backward-compat window is. Check `bridge.apiVersion` at mount time if you need to
conditionally use newer methods:

```javascript
if (parseInt(window.__docwright.bridge.apiVersion) >= 2) {
  // use v2 method
}
```
