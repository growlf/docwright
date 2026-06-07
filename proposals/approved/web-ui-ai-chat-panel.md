---
complexity: high
title: "Web UI AI Chat Panel — OpenCode Integration"
author: NetYeti
created: 2026-06-03
tags:
  - ai
  - opencode
  - web-ui
  - mcp
  - sdk
  - phase-2
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/phase-0-spike-decision.md
  - plans/completed/phase-1-opencode-embed.md
  - plans/phase-2-foundation.md
consumed_by: plans/completed/phase-1-opencode-embed.md
---

## Problem

DocWright has no AI chat surface in the Web UI. The Phase 0 spike validated
that `opencode serve` works and iframe embed is technically feasible, but that
validation was narrow by design — the goal was "does it work at all." Now that
Phase 1 is complete and Phase 2 is beginning, we need a properly considered
integration strategy before building anything.

The original iframe plan was a reasonable starting assumption. It is not the
right answer.

## Options Considered

Research was conducted against the live `sst/opencode` codebase (June 2026),
the published `@opencode-ai/sdk` npm package, the official documentation, and
four community alternative-UI implementations that prove API-only usage is
practical at production quality.

---

### Option A — Iframe embed of upstream OpenCode UI ❌ Not recommended

**How it works:** `opencode serve` co-serves its Solid.js SPA on the same port
as the HTTP API. DocWright embeds it in an iframe panel.

**Problems:**
- The upstream UI is a Solid.js SPA — entirely separate tech from DocWright's
  SvelteKit. Theming, keyboard handling, and CSP (`default-src 'self'`) all
  create ongoing friction.
- The upstream moves extremely fast (10+ commits/day). Any iframe sizing,
  theme coordination, or CSP work needs re-checking constantly.
- CSP on the upstream server is strict by default; `frame-ancestors` is not
  permissive out of the box.
- The iframe is a black box — DocWright cannot know what session is open,
  what model is selected, or what the AI just did. No governance hooks.
- No multi-provider visibility — the provider choice lives inside the black
  box with no way to surface or influence it from DocWright.

**Verdict:** Works as a demo. Unacceptable as a production integration.

---

### Option B — Fork `packages/app` ❌ Not recommended

**How it works:** Fork the OpenCode Solid.js SPA, customise it, ship it
inside DocWright.

**Problems:**
- 10+ upstream commits daily. Maintaining a fork means continuous merge
  overhead against one of the most actively developed open-source projects
  currently in existence (169k stars, 20k forks).
- The upstream team explicitly requires design review before UI changes;
  PRs that "ignore these guardrails will likely be closed." Fork maintenance
  is a solo engineering burden with no upstream support.
- DocWright does not need a full coding agent UI. A fork ships far more
  complexity than is needed.

**Verdict:** Prohibitive maintenance cost for marginal gain.

---

### Option C — API-only custom chat panel using `@opencode-ai/sdk` ✅ Recommended base

**How it works:** DocWright builds a minimal SvelteKit chat component that
talks directly to `opencode serve` via the published SDK and SSE event stream.
No iframe. No fork. No Solid.js.

**Why this is clean:**
- `@opencode-ai/sdk` is MIT, published to npm, generated from the OpenAPI spec,
  zero extra dependencies.
- The full chat/session experience is driven by three primitives:
  `session.create()`, `session.prompt()`, and SSE event subscription.
- Multiple community projects (notably `bjesus/opencode-web`) prove this is
  practical and production-quality at ~200-400 lines of code.
- DocWright owns the UI entirely — consistent theming, keyboard shortcuts,
  accessibility, and governance hooks are all native SvelteKit.
- The `--cors` flag on `opencode serve` explicitly supports this usage pattern
  (the official docs call out "custom frontends" as the reason for CORS
  configuration).

**What DocWright gets:** A SvelteKit chat panel in the Web UI that is
indistinguishable from native — same dark theme, same sidebar pattern, same
toast notifications — while delegating all AI session complexity to OpenCode.

---

### Option D — MCP-first architecture (layer on top of Option C) ✅ Strongly recommended

**How it works:** DocWright's MCP server (already built) is registered with
OpenCode as a tool provider. The AI inside OpenCode calls DocWright's tools —
`create_document`, `update_frontmatter`, `transition_status`, `check_lifecycle`,
etc. — natively as part of its tool-use loop. DocWright builds the chat panel
(Option C) for UI; OpenCode handles all AI execution.

**Why this is the right architecture:**
- DocWright is a governance layer, not an AI framework. Its job is lifecycle
  enforcement, document structure, and policy compliance — not prompt routing
  or model management.
- OpenCode already handles: model selection, token tracking, streaming,
  permission dialogs, multi-turn context, tool execution loop, retry logic,
  and all provider integrations. DocWright should not rebuild any of this.
- The MCP server is already written and working. Registering it with OpenCode
  is a config entry, not a build task.
- When the AI edits a document, DocWright's MCP tools enforce lifecycle rules
  at the point of write — not as a post-hoc check. This is the correct place
  for governance to live.

**MCP configuration** (written to vault root `opencode.json`, merged with any
existing config — never overwritten):
```json
{
  "mcp": {
    "docwright": {
      "type": "local",
      "command": ["node", "dist/mcp-server.js"],
      "args": ["--vault", "/path/to/vault"]
    }
  }
}
```

**Note on current MCP server:** `scripts/mcp-server.py` is Python. OpenCode's
`local` MCP type runs any command, so Python works — but the plan to rewrite
the MCP server in TypeScript (as part of Phase 2's dispatch module work) is
the right long-term path. Both will work; the TypeScript version is easier to
maintain alongside the rest of the dispatch module.

---

## Multi-Provider Benefit

This is not a Claude-only integration. OpenCode already supports every major
AI provider out of the box: Anthropic (Claude), OpenAI (GPT), Google (Gemini),
AWS Bedrock, Azure OpenAI, Mistral, Groq, xAI, and local models via any
Ollama-compatible endpoint — including `growlf/meshy`, DocWright's own
inference proxy for the Cascade STEAM air-gapped deployment.

DocWright inherits the full provider ecosystem for free. No provider
abstraction layer to build, no API key management to implement, no model
picker UI to design. The contributor selects their model in OpenCode once;
DocWright's chat panel works transparently with whatever is active.

This is one of the core reasons the iframe approach is wrong: the iframe gives
us OpenCode's UI but none of the governance integration. The SDK approach gives
us both — and all the providers too.

---

## Recommended Implementation

### 1. Process management

The SvelteKit server (`hooks.server.ts`) spawns `opencode serve` as a
companion process on startup:

- Bind to `127.0.0.1` on a dynamically discovered free port (use `get-port`
  or a try-bind loop — not hardcoded)
- Set `OPENCODE_SERVER_PASSWORD` to a randomly generated token at spawn time;
  store it in the SvelteKit server's memory only — never sent to the browser
- Pass `--cors` restricted to the DocWright origin
- Register `process.on('exit', ...)` and `process.on('SIGINT', ...)` cleanup
  handlers to kill the child process on SvelteKit shutdown — prevents orphaned
  `opencode serve` processes surviving server restarts
- Crash recovery: restart with exponential backoff (1s, 2s, 4s, max 30s);
  after 5 consecutive failures, surface an error state in the UI rather than
  spinning forever
- Health check: poll `GET /global/health` every 30 seconds; update connection
  state

### 2. API proxy route

A SvelteKit server route `/api/opencode/[...path]` proxies all requests to the
companion process, injecting the auth header server-side:

```
Browser → /api/opencode/session → SvelteKit server → Authorization header injected → opencode serve
```

The browser never sees the password. The proxy also handles SSE streams
(`text/event-stream`) with proper `Transfer-Encoding: chunked` pass-through.
Vault directory is injected as `x-opencode-directory` on every proxied request.

This means DocWright's Web UI never talks directly to the OpenCode process —
all traffic goes through the SvelteKit server, which applies auth and scoping
uniformly.

### 3. `opencode.json` management

On startup, DocWright reads (or creates) `opencode.json` in the vault root and
**merges** the DocWright MCP entry — never overwrites the full file. If the
user has other MCP servers or custom opencode settings, they are preserved.

```typescript
const existing = readJsonSafe('opencode.json') ?? {};
const merged = deepMerge(existing, { mcp: { docwright: MCP_CONFIG } });
writeJson('opencode.json', merged);
```

The vault's `.gitignore` is checked — `opencode.json` should be committed (it
is vault configuration, not a secret), but `OPENCODE_SERVER_PASSWORD` is
never written to disk.

### 4. Health indicator

A small connection status indicator in the Web UI toolbar (next to the existing
action buttons):

- Green dot: OpenCode connected and responding
- Yellow dot: connecting / restarting
- Red dot + "Restart" button: repeated failure, manual intervention offered

Clicking the indicator opens a small popover showing the active provider and
model (from `GET /global/config`), the opencode binary version, and the number
of active sessions.

### 5. Chat panel component

`ChatPanel.svelte` — a collapsible right-hand panel toggled by a toolbar
button. Width ~340px, persisted open/closed state in `localStorage`.

**Core capabilities:**
- Create a new session (auto-named from the current document title if one is
  open)
- Send a prompt; stream the response token-by-token via SSE
  (`message.part.updated` events)
- Show `session.status` inline: "thinking…" / "running tool: check_lifecycle"
  / "idle"
- Display tool calls as they execute — name, input summary, result summary.
  This makes the AI's governance actions visible and auditable in real time.
- Handle `permission.asked` events: surface as a native DocWright confirmation
  modal with the permission details; send `approved`/`denied` response back
  via the API. The AI cannot proceed until the human responds.

**Governance-specific quick actions:**

A row of one-click prompt starters above the input box, context-aware based on
the open document type:

| Document type | Quick actions |
|---|---|
| Proposal | "Review for completeness" · "What's missing for approval?" · "Find related proposals" |
| Plan | "Check this plan's steps for gaps" · "Verify frontmatter is complete" · "Summarise dependencies" |
| Policy | "Review for clarity and enforceability" · "Check against related policies" |
| Any | "Summarise this document" · "What should happen next?" |

These are prompt templates injected via `session.prompt()` — no special API
needed. They make the AI feel purpose-built for DocWright rather than generic.

### 6. Vault context injection

When a session is created, DocWright prepends a system-level context message
via the first `session.prompt()` call before the user's first message:

```
You are an AI assistant working inside DocWright, a governance operating system.

Vault: /path/to/vault (org-operations profile)
Current document: proposals/my-proposal.md
  title: "My Proposal"
  status: open
  author: NetYeti
  created: 2026-06-03

Available governance tools (via MCP):
- create_document, update_frontmatter, transition_status, check_lifecycle,
  get_related_documents, validate_frontmatter_schema

Governance rules in effect:
- Proposals require approved: true before a plan can be created
- Plans require status: in-progress before tasks can be marked done
- The AI cannot set approved: true on any document (human gate required)
```

When the user navigates to a different document while the panel is open,
a brief context update is appended to the running session ("Context update:
now viewing policies/data-retention.md — status: draft"). The session is not
reset on navigation, preserving conversation continuity.

### 7. Graceful degradation

If `opencode` is not found on PATH at startup:
- The chat panel renders with a friendly "OpenCode not installed" state
- A link to `opencode.ai` and the install command (`npm i -g opencode`) is
  shown
- The rest of DocWright functions normally — the AI panel is additive, not
  required

If the opencode binary is found but the version is incompatible with the SDK:
- A warning is shown in the health indicator popover
- The panel still attempts to connect; most API surface is stable across minor
  versions

---

## Known Risks and Open Questions

These are not blockers but must be addressed during planning:

| Risk | Severity | Mitigation |
|---|---|---|
| **Child process orphaning on HMR** — Vite's hot module reload during dev restarts `hooks.server.ts`; a naive implementation spawns a new opencode process each time without killing the old one | High | Track the child PID in a module-level singleton; check if already running before spawning; kill explicitly on module reload via Vite's `import.meta.hot.dispose()` |
| **Port collision** — hardcoding a port breaks if something else is running there | Medium | Use `get-port` npm package or a try-bind loop on a random high port |
| **SSE proxy complexity** — piping a long-lived SSE stream through a SvelteKit server route requires careful handling of backpressure, connection drops, and client reconnects | Medium | Use SvelteKit's built-in `ReadableStream` support; test with slow connections and browser tab backgrounding |
| **opencode.json conflicts** — user may have existing opencode.json with settings DocWright shouldn't touch | Medium | Always merge, never overwrite; log when a merge changes anything |
| **Multi-vault: one opencode serve or many?** — DocWright supports multiple vaults via the project registry; one global `opencode serve` with directory routing vs. one per vault is an unresolved question | Medium | Start with one per active vault (simplest, cleanest isolation); defer per-vault resource management to post-launch |
| **MCP server language (Python vs TypeScript)** — `opencode.json` config must match the actual server command; Python works now but is inconsistent with the dispatch module direction | Low | Python works fine for MVP; note in plan to migrate to TypeScript when dispatch module MCP rewrite happens |
| **SDK version coupling** — `@opencode-ai/sdk` must match the installed opencode binary version | Low | Pin the SDK version; check `GET /global/health` for version mismatch on startup; warn, don't fail |
| **Permission dialog event loop** — `permission.asked` events need a response or the AI hangs; the SSE listener must be persistent and capable of surfacing UI | Low | The SSE subscription runs for the session lifetime; surface via a Svelte store that the permission modal reads |

---

## Out of Scope

Each item is captured as a deferred proposal.

| Idea | Why deferred | Deferred proposal |
|---|---|---|
| Terminal / PTY panel | High complexity; security surface; not needed for governance | [[proposals/web-ui-terminal-panel.md]] |
| Diff / review panel | Requires Phase 3 dispatch integration for governance-aware annotations | [[proposals/web-ui-diff-review-panel.md]] |
| Full session management UI (fork, share, summarize, delete) | OpenCode handles internally; MVP first | [[proposals/web-ui-session-management.md]] |
| `@document` mention in chat to inject document context | Great UX idea; straightforward to add post-MVP | [[proposals/chat-at-mention-context.md]] |
| Session history tied to vault (filter sessions by vault path) | Useful for multi-vault users; post-MVP | [[proposals/chat-vault-session-history.md]] |
| Model / provider picker in chat panel header | OpenCode handles model selection; expose as convenience after MVP is stable | [[proposals/chat-model-picker.md]] |
| Sticky governance system prompt configurable per profile | Excellent idea — each profile defines its own AI instructions; post-MVP | [[proposals/profile-opencode-system-prompt.md]] |
| DocWright-as-OpenCode-plugin (vs. MCP) | Plugin system has no UI hooks; MCP is the correct integration point | Not worth pursuing |

## Security Considerations

- `opencode serve` binds to `127.0.0.1` only — not exposed to the network.
- `OPENCODE_SERVER_PASSWORD` is generated at spawn time, held in SvelteKit
  server memory, injected server-side by the proxy route, and never written
  to disk or sent to the browser.
- CORS is locked to the DocWright origin only.
- The API proxy route means the browser has no direct path to the OpenCode
  process — all traffic is authenticated and scoped at the SvelteKit layer.
- MCP tools that perform lifecycle transitions require `HUMAN_APPROVED`
  semantics — the AI cannot self-approve proposals, complete phase gates, or
  set `approved: true` on any document.
- Permission dialogs are always shown to the human before the AI proceeds.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — replaces iframe assumption from Phase 0 spike | NetYeti |
| 2026-06-03 | Enhanced: quick actions, health indicator, proxy route, context injection detail, risks, additional deferred proposals | NetYeti |
