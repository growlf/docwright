# DocWright v0.5.0 — Phase 4 close

**Released:** 2026-07-11 · **Range:** `v0.4.12..v0.5.0` (15 commits)

`0.5.0` closes **Phase 4** (minor = phase). A large body of AI-integration and platform
work shipped across the 0.4.x line; this release pins that state and formally closes the
phase. Phase 4's undelivered namesake core (profile-engine runtime + ACL controller) is
deferred to Phase 5 — see `proposals/deferred-phase-4-carryover-profile-engine-acl-ai.md`.

## Security

- **Path-traversal fixed in the MCP file layer** (#322). `src/mcp/lib/paths.ts` now
  enforces canonical containment (`resolveSafe`) on every I/O helper — read, write,
  exists, mtime, glob, move.

## Governance & lifecycle integrity

- **Web UI completion flow repaired** (#324). "Run Tests" now persists its evidence
  (`tests_last_*`) and "Complete" archives the plan through the gate — the completion
  deadlock is gone.
- **`update_step` no longer corrupts table rows** (#325). `splitTableRow` is
  backtick/escape-aware, so code-span pipes (`` `category: bug|feature` ``) survive.
- **Versioning policy reconciled with practice** (#327). Patch is now defined as
  per-release (not a never-derived "completed-plan count"); the CI version-consistency
  gate covers `VERSION`, `package.json`, and `src/webui/package.json`; retired-`develop`
  references scrubbed.
- **`phase:close` counts plans by `phase:` frontmatter** (#328), not just the
  `phase-N-` filename prefix — so feature-named phase plans are visible to the close-out.

## Reliability & tooling

- **Flaky `bridge.test.ts` eliminated** (#326) — `suggestDuplicates` takes an injectable
  gh-query, so the 2000 ms timeout is gone and the suite is deterministic.
- Removed a stray reconcile-merge duplicate plan (#319); skills converted to the
  registered `dir/SKILL.md` layout (#316); milestone-driven roadmap discipline adopted (#320).

## Known follow-ups

- **`phase:close` cannot direct-push to PR-protected `main`** (GH #329) — this release was
  cut via a release-branch PR + manual tag as a result. Fix tracked for a later patch.

## Deferred to Phase 5

- The Phase 4 carryover: full profile engine, `profile.json` validation, ACL controller,
  Forgejo branch-protection enforcement, AI-write-through-ACL, backlink index, LLM Wiki
  engine, per-profile `opencode-instructions.md`, and the frontmatter linter. See the
  carryover proposal.

_Full commit log: `git log v0.4.12..v0.5.0`._
