# issues/ — DocWright code-issue store

This directory is DocWright's in-vault **code-issue** store, established by
[[plans/separate-dev-tracking-milestones-and-beta-channel]] (GitHub #68), Step 2.

## What lives here

Work whose **deliverable is a diff** — code-issues and bugs, closed by a PR. This is the
"code" half of the code-issue ↔ governance split:

| Question | Home |
|----------|------|
| Is the deliverable a diff? | **`issues/`** (this dir) — `code-issue` / `bug`, closed by a PR |
| Is the deliverable a durable rule/decision/spec? | `proposals/` → `plans/` → `policies/` / `decisions/` |
| Both? | one of each, **cross-linked** (`cross_link:`) |

## Why in-vault (not GitHub Issues / a database)

Keeps DocWright's invariants intact: **git is canonical, no auxiliary database, no
telemetry.** Because the repo is public, these files remain network-readable for the
end-user reporting bridge without any external store. GitHub Issues is the *public intake
channel* that feeds triage; accepted issues land here.

## Grammar

Governed by the `docwright-dev` profile (`src/profiles/docwright-dev/`). Types & lifecycle:

- **`code-issue`** / **`bug`** — `open → in-progress → resolved → wont-fix`
- A code-issue is **closed by a PR** — record it in `closed_by_pr:`; do not mark `resolved`
  without the merged PR reference.
- If a code-issue implements a governance doc, set `cross_link:` to it (and vice-versa).

Templates: `src/profiles/docwright-dev/templates/{code-issue,bug}.md`.

## Milestones

Once Step 3 lands, every open item here carries a `milestone:` (a real milestone or the
literal `future`), lint-enforced. Until then, items are unscheduled.
