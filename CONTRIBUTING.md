# Contributing to DocWright

Welcome. DocWright is MIT-licensed and built by a community of humans and AI
tools working together. Every kind of contribution matters — code, governance
design, documentation, profile authoring, bug reports, or simply using the
tool and telling us what breaks.

If you are here, you belong here.

---

## Understanding the project

Start with these files, in this order:

1. `docs/collaboration.md` — how the project works, who is involved, and the
   philosophy behind the multi-perspective review practice
2. `CLAUDE.md` — architecture, core invariants, what not to break
3. `PROJECT.md` — the full specification (v0.8+)

For significant changes, open a proposal in the vault (or a GitHub issue)
before writing code. DocWright uses its own governance workflow on itself —
discussion happens in `proposals/` before it happens in pull requests.

---

## Branching and release workflow

DocWright uses a **trunk-based** workflow: `main` is the trunk — always the
latest integrated code. Features branch off `main` and PR back into `main`.
Releases are cut as `release/v*.*.*` branches and tagged from there.

```
feat/fix/chore branch  ──PR──→  main  ──cut──→  release/v*.*.*  ──tag──→  v*.*.*
```

**Feature / fix / chore branches** — branched from `main`, named by a typed
prefix (enforced by the branch-policy CI check):
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation
- `chore/<short-description>` — maintenance
- also accepted: `refactor/`, `test/`, `policy/`, `decision/`

**`main`** — the trunk and integration branch. All typed-prefix branches merge
here via PR. Protected: CI passing, linear history (squash merges), and the
branch-policy check. **`main` HEAD is not guaranteed deployable — consume tagged
releases, not `main` HEAD.**

**`release/v*.*.*`** — cut from `main` when a milestone is ready. Version bumps
and changelog updates happen here; tagging `v*.*.*` triggers the Docker
deployment to ghcr.io. The bump is merged back to `main` via PR. Urgent fixes
use `hotfix/*`.

### Plan-scoped work (branch until complete)

Work that executes a **plan** (anything under `plans/`) does **not** merge to
`main` step-by-step. All of a plan's changes land on a **long-lived integration
branch** (e.g. `dogfood`) — one PR per step, merged into that branch as you go —
and `main` sees the plan only once, as a **single completion PR** when the whole
plan is finished. That completion PR **MUST include at minimum a patch-level
version bump**.

Why: `main` should never carry a half-finished plan (partial plans mislead other
work and can ship broken intermediate states). The completion PR is the atomic,
versioned, reviewable unit. The integration branch is also what the dogfood
container serves, so code and plan-tracking stay together while the plan is in
flight. Plans should be attached to a milestone / sub-milestone for roadmap
tracking. This operationalizes the phase-driven scheme (`0.{phase}.{completed
plans}` — patch = completed plans; see [[policies/core/versioning.md]]).

One-off fixes, docs, and chores that are **not** part of a plan still follow the
normal trunk flow above.

### Quick start

```bash
git fetch origin
git checkout -b feat/my-thing origin/main   # branch off the trunk
# ... work, commit, push ...
gh pr create --base main                     # PR back to the trunk
```

## Development setup

```bash
git config core.hooksPath .githooks   # activate commit hooks (once, after cloning)
cp .env.example .env                  # fill in your name, email, vault path
npm install
npm run compile        # TypeScript compile check
npm run lint           # ESLint + Prettier
npm run test:dispatch  # dispatch module tests (run outside extension host)
npm run test:webui     # Web UI unit tests (session store, OCC, local auth)
```

The pre-commit hook validates frontmatter and records identity/network info.
The commit-msg hook enforces conventional commit format. Both are required —
`core.hooksPath` wires them in.

### Running the Web UI

```bash
cd src/webui
npm install
npm run dev    # starts at http://localhost:5173
```

By default `AUTH_MODE=none` — no login required. To test with local auth:

```bash
# In your .env:
AUTH_MODE=local
SESSION_SECRET=$(openssl rand -hex 32)
LOCAL_AUTH_USER=admin
LOCAL_AUTH_PASSWORD=testpassword
LOCAL_AUTH_EMAIL=admin@localhost
LOCAL_AUTH_DISPLAY_NAME=Admin
```

Restart `npm run dev` after changing `.env`. See [docs/authentication.md](./docs/authentication.md)
for the full auth setup guide including Forgejo OAuth.

---

## The one rule you cannot break

**`src/dispatch/` must have zero VS Code API dependencies.**

The dispatch module is the heart of DocWright. It runs outside the extension
host and must stay that way. `npm run test:dispatch` catches violations. If
your import from `vscode` is in `src/dispatch/`, the CI will fail and your PR
will not merge. This is intentional and permanent.

---

## Code standards

- TypeScript strict mode throughout
- ESLint + Prettier — run `npm run lint` before committing
- All public dispatch functions must be unit-testable with a plain filesystem mock
- No telemetry. Ever. Not even anonymised.

---

## Proposals and plans

DocWright uses its own lifecycle for decisions. If you have a significant
change in mind:

1. Check `proposals/` — it may already exist as a deferred proposal
2. If not, open one (use `templates/proposal-template.md`)
3. Discuss it in the proposal or in a GitHub issue
4. Once approved, a plan is created and work begins

Small fixes (typos, obvious bugs, documentation) can go straight to a PR.

---

## Adding profiles

A new bundled profile lives at `src/profiles/[name]/` and contains:

- `profile.json` — manifest (name, states, document types, features)
- `schema.json` — frontmatter JSON Schema
- `opencode-instructions.md` — AI context injected when the profile is active
- `templates/[type].md` — one per document type

**All templates must include `author-role:` frontmatter.** Default: `contributor`.
The `opencode-instructions.md` must embed the core philosophy and instruct
the AI to prompt for security, policy, and verification considerations.

See `src/profiles/doc-lifecycle/` as the reference implementation.

---

## Attribution

If your contribution incorporates patterns, code, or concepts from another
project, add them to `NOTICE.md`. The existing entries show the format.
We take attribution seriously — it is part of how we say thank you.

---

## How decisions are made

DocWright uses a BDFL model. NetYeti (growlf on GitHub) makes final calls.
All significant decisions are documented as proposals before they become plans,
and plans before they become code. The paper trail is the point.

AI tools (Claude, BigPickle) contribute drafts and critique. Humans decide.
`approved: true` on any proposal requires a human commit. That is not a
formality — it is the governance model in action.

---

## Thank you

Whether you are fixing a typo, designing a profile for your industry, or
contributing a major feature — your work makes DocWright better for everyone
who adopts it. Human contributors especially: the AI tools write fast, but
they write what they are told. The ideas, the judgment, the real-world
context — that comes from you.
