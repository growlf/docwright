---
title: "Phase Close-Out from Web UI"
author: NetYeti
created: 2026-06-25
tags:
  - webui
  - phase-management
  - lifecycle
  - ux
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

Phase close-out currently requires running `npm run phase:close -- N` from the command line. This:
- Requires developer tooling (Node, npm, tsx) to be available on the closing machine
- Is invisible to non-developer contributors who use the Web UI exclusively
- Produces no feedback in the UI about whether a phase is ready to close
- Cannot be triggered by the BDFL from a browser, tablet, or non-dev machine

The Web UI already shows active plans, phase status, and the Knowledge Graph. It has all the context needed to surface "Phase N is complete — ready to close?" and execute the close-out with a single button.

## Proposed Solution

Add a phase close-out action to the Web UI:

1. **Phase readiness indicator** — on the `/status` page, detect when all plans for the current phase have `status: completed`. Show a "Phase N ready to close" banner with a summary of what completed.

2. **Close Phase button** — a human-gated action button (confirmation dialog: "Bump version to 0.N+1.0, create release tag, push?") that calls a new API endpoint.

3. **`POST /api/phase/close`** — server-side endpoint that:
   - Validates all phase plans are completed
   - Bumps `VERSION` and `package.json`
   - Commits with the standard message
   - Creates and pushes the release tag
   - Returns a status stream (SSE) so the UI can show progress

4. **SSE progress feed** — the close-out runs async; the UI shows live output (version bumped, commit created, tag pushed, CI link).

The endpoint reuses the logic from `scripts/phase-close.ts`, refactored into a callable function.

## Alternatives Considered

- **Keep CLI-only** — works, but excludes non-developer contributors and makes phase governance feel like an engineering ceremony rather than a team milestone.
- **MCP tool `phase_close`** — better than CLI but still requires an AI session. The Web UI puts this in front of the whole team.

## Future

- Phase close-out could trigger a notification (email, Slack) to all contributors when available in Phase 5.
- The phase readiness check could become a continuous indicator in the sidebar nav.
