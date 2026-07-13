# GitHub Project schema — DocWright dev-issue board

Canonical field mapping for the issue-tracking pivot
([[plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference]]).
Step 2 deliverable. The read/relate layer (Step 3), capture rework (Step 4), and the
lossless migration (Step 5) all key off the field **names** below — they resolve field
ids at runtime by name, so this schema survives the Project being recreated.

## Project

| | |
|---|---|
| Title | **DocWright Dev** |
| Owner | `growlf` (user) |
| Number | 3 |
| URL | https://github.com/users/growlf/projects/3 |
| Node id | `PVT_kwHOABJHO84BdPEu` → `DOCWRIGHT_GH_PROJECT_ID` |

## Fields — local issue signal → GitHub home (Bar-B fidelity)

Bar B = preserve `demand_count` + **every** `reported_date`; the parity gate (Step 6)
asserts no data lost and ranking preserved, not byte-identical time-weighted scores.

| Project field | Type | Maps from (local frontmatter) | Role |
|---|---|---|---|
| **Lifecycle** | single-select | `status` | Canonical issue state — the board's grouping column. Options: `new, triaged, scope-checked, awaiting-proposal, proposal-linked, resolved, deferred, duplicate` (exact linter enum). |
| **Priority** | single-select | `priority` | `critical, high, medium, low`. |
| **Demand** | number | `demand_count` | Heatmap fuel — sortable demand. Migration also stamps a `demand:N` label (proposal). |
| **Reported Dates** | text | `reported_dates` | JSON array of **every** report date, verbatim. Bar B's "no lost date" — the heatmap reads dates back from here, not the body. |
| **Channel** | text | `channel` | Capture channel/source signal. |
| **DocWright ID** | text | original slug (`issues/<slug>.md`) | Reversibility + dedup key + the stable id proposals/plans link to. Migration is idempotent on this. |
| **Scope Decision** | text | `scope_decision` | Short scope verdict for board filtering. |

### Stays in the issue body (verbatim, not a field)
`scope_assessment`, `scope_notes`, full description, system info, and history →
issue **body** + comments. `related` / `consumed_by` → body cross-ref links.
`github_issue:` (present on 59 of 96 local issues) → **reused** as the canonical id;
an already-mirrored issue is updated, never duplicated.

### Native GitHub fields used as-is
- **Milestone** (built-in) ← `milestone` (25 issues).
- **Labels** ← `category:<x>`, `demand:N`, and status tags.
- **Linked pull requests** (built-in) — issue↔PR linkage, automatic.
- **Status** (built-in Todo/In Progress/Done) — GitHub can't edit its options via API,
  so it is *not* the source of truth. Optional coarse board mapping:
  `new,triaged → Todo` · `scope-checked,awaiting-proposal,proposal-linked → In Progress`
  · `resolved,deferred,duplicate → Done`. **Lifecycle** is authoritative.

## Field ids (dev board, 2026-07-13 — for reference; resolve by name in code)

```
Lifecycle        PVTSSF_lAHOABJHO84BdPEuzhXyBvE   (single-select)
Priority         PVTSSF_lAHOABJHO84BdPEuzhXyBvI   (single-select)
Demand           PVTF_lAHOABJHO84BdPEuzhXyBv0     (number)
Reported Dates   PVTF_lAHOABJHO84BdPEuzhXyBwE     (text)
Channel          PVTF_lAHOABJHO84BdPEuzhXyBwI     (text)
DocWright ID     PVTF_lAHOABJHO84BdPEuzhXyBwM     (text)
Scope Decision   PVTF_lAHOABJHO84BdPEuzhXyBwQ     (text)
```

## Env wiring (dev instance)

```
DOCWRIGHT_GH_REPO=growlf/docwright
DOCWRIGHT_GH_TOKEN=<fine-grained PAT: growlf/docwright, Issues R+W + Projects R+W>
DOCWRIGHT_GH_PROJECT_ID=PVT_kwHOABJHO84BdPEu
```

> **Token gate (security):** the board was created with a broad classic PAT used as a
> temporary session token. Before cutover (Step 7) and before any other instance is
> pointed at this, swap the runtime token to a **fine-grained PAT scoped to only
> `growlf/docwright` Issues+Projects**, stored in Bitwarden, and revoke the broad one.
