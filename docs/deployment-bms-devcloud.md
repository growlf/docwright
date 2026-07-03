# DocWright BMS Dev-Cloud — Deployment Architecture

**Status:** DRAFT for review (design converging — not yet a proposal/plan)
**Host:** `10.10.0.201` (BMS environment), Linux user `gemini`
**Reverse proxy:** NPMPlus @ `10.10.0.11` (Proxmox host `crash`), naming `*.bms.local`
**Purpose:** BMS is the **dev-cloud** for DocWright itself and for the `cs-erp-images`
DocWright plugin. `cs-erp-images` drives **live** ERPNext deployments for Cascade STEAM
customers (including CS itself), so tool development must be cleanly separated from real
customer data.

---

## The three deployments

| # | Name | Mode | Tracks | Vault (managed content) | URL | Port | Users |
|---|------|------|--------|--------------------------|-----|------|-------|
| 1 | **dogfood-dev** | host `npm run dev` (no container) | long-lived `dogfood` branch (Web-UI driven) | **itself** (the DocWright checkout) | `docwright-dev.bms.local` | 5173 | multiple (raw dev) |
| 2 | **csdocs-stable** | container (release image) | latest release tag | `~/Projects/csdocs` → `CascadeSTEAM/csdocs` (`master`) | `csdocs.bms.local` | 5274 | multiple real |
| 3 | **erp-images-stable** | container (release) + `erp-images` plugin | latest release tag | `~/Projects/cs-erp-images` → `CascadeSTEAM/cs-erp-images` | `erp-images.bms.local` | 5275 | TBD |

All three run on `10.10.0.201` under `gemini`, each fronted by an NPMPlus proxy host
(`*.bms.local` → `10.10.0.201:<port>`).

---

## Deployment 1 — dogfood-dev

- **Goal:** improve DocWright *through* DocWright — it manages its own governance docs and
  proves itself as it evolves. Multi-user dogfooding + raw development; mistakes tolerated.
- **Mode:** runs directly from a git checkout via `npm run dev --host 0.0.0.0 --port 5173`.
  **No container** — live-editing the source is the point.
- **Folder:** `~/Projects/DocWright-development` (fresh clone, separate from the co-dev tree).
- **Branch:** long-lived **`dogfood`** branch. State is driven by the DocWright Web UI git
  controls (+ occasional manual fixes). Synced from `main` periodically; good, general work
  is PR'd back to `main`.
- **Vault:** serves **itself** (`DOCWRIGHT_ROOT` = the checkout root).
- **URL:** `docwright-dev.bms.local`.

### Leap-frog model (working tree ↔ dev instance)

| Tree | Branch | Role |
|------|--------|------|
| `~/Projects/DocWright` (co-dev working tree) | `main` | Where **we** do reviewed work, manage #2/#3 via scripts/config, cut PRs. **No local code edits** — deployment-specific settings live in **gitignored config** only. |
| `~/Projects/DocWright-development` (dev instance) | `dogfood` | Web-UI driven, multi-user, mistakes OK. Synced from `main`; good bits PR'd back. |

- **"Leap-frog" = `main` ↔ `dogfood` sync + selective PRs upstream** via the shared
  `growlf/docwright` remote.
- **Design decision:** we do **not** keep uncommitted local changes as a management strategy
  (that is the "memory instead of code" failure mode). Deployment-specific bits → gitignored
  config; experimental-but-not-general work → committed on `dogfood` until it's general enough
  to PR into `main`.
- *(Open variation: pin the co-dev working tree to a release tag instead of `main` if we want
  it "stable" rather than trunk-latest.)*

---

## Deployment 2 — csdocs-stable

- **Goal:** real users manage Cascade STEAM documentation & policy, using DocWright as the
  primary tool. Git actions here drive the **csdocs** content repo, **not** DocWright.
- **Mode:** containerized DocWright from the **release image**; `update.sh`/compose pattern
  with `TRACK=release` (same mechanism as the current dogfood, parameterized).
- **Code vs vault separation:** the DocWright code checkout is disposable (hard-reset to the
  release tag, never committed). The **vault is a host clone of `~/Projects/csdocs`**
  bind-mounted at `/vault`; commits/pushes go to `CascadeSTEAM/csdocs` (`master`).
- **URL:** `csdocs.bms.local`, port 5274.
- **Replaces** the current throwaway dogfood at `:5273` (retire it).

---

## Deployment 3 — erp-images-stable

- **Goal:** manage the `cs-erp-images` **tool repo** with DocWright (+ the `erp-images`
  plugin), while it also supports real CS ERPNext deployments. **No CS-specific data may ever
  enter the tool repo.**
- **Mode:** containerized release image + `erp-images` plugin. Vault = host clone of
  `~/Projects/cs-erp-images` (needs cloning under `gemini`; today the DocWright plugin symlink
  points into `/home/netyeti/...` — to be resolved).
- **URL:** `erp-images.bms.local`, port 5275.

### Data-separation model (three tiers)

- **Tier A — Tool repo (`cs-erp-images`)** — image *definitions* named by **generic use-case
  intent** (`erp-msp-project_community`, never `cascadesteam`), `apps.json` → GHCR.
  Public/shareable, git-versioned, pushed upstream. **DocWright #3 manages only this.**
- **Tier B — Deployment mapping/config** — which real customer runs which generic image,
  per-site settings. CS-specific; **never** in Tier A. Lives on CS infra eventually.
- **Tier C — Customer backups / private data** — real ERPNext dumps. **Private customer data.**
  Never in git, never casually on the dev host. Dedicated **access-limited store (NAS/Ceph)**
  with best-practice handling (encryption at rest, restricted access, retention/rotation).

### Guardrails

- Tool repo `.gitignore` excludes any customer-data paths; the #3 vault never mounts Tier B/C.
- **Commit-time enforcement** (deferred proposal) blocks customer names/identifiers and
  customer data from entering the tool repo — code-over-memory, not discipline.
- Naming lint: image use-case names must match a generic-intent pattern (no customer names).

### Trust boundary & migration

- **Initially** #3 (and any transitional deployment data) sits on the BMS dev-cloud **only
  while we carve out the tool foundation.**
- **Eventually** the real deployment + customer data lives on the **CS environment**, backing
  up to **BMS**.

---

## Cross-cutting decisions

### Identity / auth (phased — does NOT block standup)
- **Interim:** each deployment commits under a **static service identity**
  (e.g. `DocWright (csdocs) <docwright+csdocs@…>`); DocWright `author-role:` frontmatter +
  audit stamps carry finer detail. We document plainly that commits are service-attributed,
  not per-user (audit honesty).
- **Deferred proposal:** real multi-user OAuth login → per-user git attribution
  (DocWright "Team Server" auth story: Web UI OAuth + GitHub/Forgejo identity + ACL).

### Git push auth (containers)
- **Per-repo deploy keys** (SSH, scoped, revocable) stored in **VaultWarden**
  (`bitwarden.bellinghammakerspace.org`, `bw get item`) and mounted into #2/#3 containers.
  Preferred over a broad PAT.

### Reverse proxy / DNS
- NPMPlus (`10.10.0.11`) proxy host per deployment: `*.bms.local` → `10.10.0.201:<port>`.
- Keep existing GitHub remotes; **no Forgejo commitment now** (revisit only if its OAuth/privacy
  wins clearly outweigh the migration cost).

---

## Deferred proposals to capture (per capture-deferred-ideas policy)

1. **Multi-user OAuth identity → per-user git attribution** (the real auth solution).
2. **Customer-data backup store** — NAS/Ceph, access-limited, encryption, retention;
   Tier C handling + eventual CS→BMS backup flow.
3. **Tool-repo customer-data guardrail** — commit-time enforcement + naming lint that keep
   CS-specific data/names out of `cs-erp-images`.
4. **Multi-instance deployment tooling** — generalize the dogfood `update.sh`/compose into a
   parameterized, repeatable deploy mechanism (one-off → formalization).

---

## Open items / TBD

- [ ] Where to commit this doc + which pieces become proposals/plans (DocWright repo vs bms-ai-cluster).
- [ ] Resolve `cs-erp-images` location/owner for the `gemini`-run #3 (currently symlinked into `/home/netyeti`).
- [ ] `erp-images` plugin wiring into the release container (how the plugin loads from the vault repo).
- [ ] Exact static service-identity strings + deploy-key names in VaultWarden.
- [ ] Order of operations for retiring `:5273` and standing up #2.
