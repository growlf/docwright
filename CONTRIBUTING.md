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

## Development setup

```bash
git config core.hooksPath .githooks   # activate commit hooks (once, after cloning)
npm install
npm run compile        # TypeScript compile check
npm run lint           # ESLint + Prettier
npm run test:dispatch  # dispatch module tests (run outside extension host)
```

The pre-commit hook validates frontmatter and records identity/network info.
The commit-msg hook enforces conventional commit format. Both are required —
`core.hooksPath` wires them in.

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
