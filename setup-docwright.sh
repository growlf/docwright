#!/usr/bin/env bash
# =============================================================================
# docwright — Repository Setup Script
# Run from the root of your cloned docwright repo:
#   bash setup-docwright.sh
# =============================================================================
set -e

REPO_ROOT="$(pwd)"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          docwright — Repository Setup Script             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Running from: $REPO_ROOT"
echo ""

# Guard: make sure we're in the right repo
if [ ! -f "$REPO_ROOT/CLAUDE.md" ]; then
  echo "ERROR: CLAUDE.md not found."
  echo "Please run this script from the root of your docwright repo"
  echo "and make sure you've already copied CLAUDE.md into it."
  exit 1
fi

# ─── STEP 1: Create directory skeleton ───────────────────────────────────────
echo "▶ Step 1: Creating directory skeleton..."

mkdir -p src/extension
mkdir -p src/dispatch
mkdir -p src/webui
mkdir -p src/profiles/org-operations
mkdir -p src/profiles/doc-lifecycle
mkdir -p src/profiles/infra-topology
mkdir -p src/profiles/knowledge-base
mkdir -p test/dispatch
mkdir -p example-vault/policies/core
mkdir -p example-vault/policies/program-areas
mkdir -p example-vault/inbox
mkdir -p example-vault/issues
mkdir -p example-vault/proposals
mkdir -p example-vault/decisions
mkdir -p spike/opencode-embed
mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE

echo "   ✓ Directories created"

# ─── STEP 2: LICENSE ─────────────────────────────────────────────────────────
echo "▶ Step 2: Writing LICENSE..."

if [ ! -f "$REPO_ROOT/LICENSE" ]; then
cat > "$REPO_ROOT/LICENSE" << 'EOF'
MIT License

Copyright (c) 2026 NetYeti (growlf)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
  echo "   ✓ LICENSE written"
else
  echo "   ↷ LICENSE already exists — skipped"
fi

# ─── STEP 3: CHANGELOG.md ────────────────────────────────────────────────────
echo "▶ Step 3: Writing CHANGELOG.md..."

if [ ! -f "$REPO_ROOT/CHANGELOG.md" ]; then
cat > "$REPO_ROOT/CHANGELOG.md" << 'EOF'
# Changelog

All notable changes to docwright will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository structure
- PROJECT.md v0.8 — full architecture specification
- CLAUDE.md — AI agent context for Claude Code sessions
- Bundled profile stubs: org-operations, doc-lifecycle, infra-topology, knowledge-base
- Example vault with Cascade STEAM seed documents
- Phase 0 spike directory for opencode serve validation
EOF
  echo "   ✓ CHANGELOG.md written"
else
  echo "   ↷ CHANGELOG.md already exists — skipped"
fi

# ─── STEP 4: SECURITY.md ─────────────────────────────────────────────────────
echo "▶ Step 4: Writing SECURITY.md..."

if [ ! -f "$REPO_ROOT/SECURITY.md" ]; then
cat > "$REPO_ROOT/SECURITY.md" << 'EOF'
# Security Policy

## Supported Versions

docwright is currently in pre-alpha. Security fixes will be applied to the
latest version only.

| Version | Supported |
|---------|-----------|
| 0.x.x   | ✅        |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Email: growlfd@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. If the vulnerability is confirmed,
we will work with you on a coordinated disclosure timeline.

## Scope

Security concerns relevant to docwright include:
- The Web UI server (localhost by default — binds to 127.0.0.1 only)
- The Forgejo OAuth integration
- The AI dispatch layer and trust tier enforcement
- The `author-role:` ACL model
- Pre-receive hook scripts

Out of scope: vulnerabilities in upstream dependencies (OpenCode, Forgejo,
SvelteKit, markdown-it). Please report those to their respective projects.
EOF
  echo "   ✓ SECURITY.md written"
else
  echo "   ↷ SECURITY.md already exists — skipped"
fi

# ─── STEP 5: CONTRIBUTING.md ─────────────────────────────────────────────────
echo "▶ Step 5: Writing CONTRIBUTING.md..."

if [ ! -f "$REPO_ROOT/CONTRIBUTING.md" ]; then
cat > "$REPO_ROOT/CONTRIBUTING.md" << 'EOF'
# Contributing to docwright

Thank you for your interest in contributing. docwright is MIT-licensed and
welcomes contributions from the community.

## Before You Start

Read `CLAUDE.md` for architectural context and `PROJECT.md` for the full spec.
For significant changes, open an issue first so we can discuss the direction.

## Development Setup

```bash
npm install
npm run compile      # TypeScript compile check
npm run lint         # ESLint
npm run test:dispatch  # Run dispatch unit tests (outside extension host)
```

## The Most Important Rule

**The dispatch module (`src/dispatch/`) must have zero VS Code API dependencies.**

The CI pipeline runs `npm run test:dispatch` outside the extension host.
If you import anything from `vscode` in `src/dispatch/`, the tests will fail.
This is intentional and must never be bypassed.

## Code Style

- TypeScript strict mode throughout
- ESLint + Prettier (run `npm run lint` before committing)
- All public dispatch functions must be unit-testable with a plain filesystem mock

## Templates and Profiles

All profile templates (`src/profiles/*/templates/*.md`) **must** include
the `author-role:` frontmatter field. Default value: `contributor`.
This is a hard requirement — see PROJECT.md §6 for rationale.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run lint && npm run test:dispatch` — both must pass
4. Submit a PR with a clear description of what changed and why
5. PRs require one reviewer approval before merge

## Profile Authoring

To add a new bundled profile, create a directory under `src/profiles/[name]/`
containing: `profile.json`, `schema.json`, `opencode-instructions.md`,
and `templates/` with one `.md` file per document type.
See `src/profiles/doc-lifecycle/` as the reference implementation.

## Attribution

If your contribution incorporates patterns, code, or concepts from other
projects, add them to `NOTICE.md`. See the existing entries for format.

## Governance

docwright uses a BDFL model. NetYeti (growlf) makes final decisions.
All significant decisions are documented in `PROJECT.md` and `CHANGELOG.md`.
EOF
  echo "   ✓ CONTRIBUTING.md written"
else
  echo "   ↷ CONTRIBUTING.md already exists — skipped"
fi

# ─── STEP 6: .prettierrc ─────────────────────────────────────────────────────
echo "▶ Step 6: Writing .prettierrc..."

if [ ! -f "$REPO_ROOT/.prettierrc" ]; then
cat > "$REPO_ROOT/.prettierrc" << 'EOF'
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
EOF
  echo "   ✓ .prettierrc written"
else
  echo "   ↷ .prettierrc already exists — skipped"
fi

# ─── STEP 7: .eslintrc.json ──────────────────────────────────────────────────
echo "▶ Step 7: Writing .eslintrc.json..."

if [ ! -f "$REPO_ROOT/.eslintrc.json" ]; then
cat > "$REPO_ROOT/.eslintrc.json" << 'EOF'
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "overrides": [
    {
      "files": ["src/dispatch/**/*.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": ["vscode"],
            "message": "The dispatch module must have zero VS Code API dependencies. See CONTRIBUTING.md."
          }
        ]
      }
    }
  ]
}
EOF
  echo "   ✓ .eslintrc.json written"
else
  echo "   ↷ .eslintrc.json already exists — skipped"
fi

# ─── STEP 8: tsconfig.json ───────────────────────────────────────────────────
echo "▶ Step 8: Writing tsconfig.json..."

if [ ! -f "$REPO_ROOT/tsconfig.json" ]; then
cat > "$REPO_ROOT/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test", "spike"]
}
EOF
  echo "   ✓ tsconfig.json written"
else
  echo "   ↷ tsconfig.json already exists — skipped"
fi

# ─── STEP 9: package.json ────────────────────────────────────────────────────
echo "▶ Step 9: Writing package.json..."

if [ ! -f "$REPO_ROOT/package.json" ]; then
cat > "$REPO_ROOT/package.json" << 'EOF'
{
  "name": "docwright",
  "displayName": "docwright",
  "description": "Organizational operating system for policy-driven teams",
  "version": "0.0.1",
  "license": "MIT",
  "publisher": "growlf",
  "repository": {
    "type": "git",
    "url": "https://github.com/growlf/docwright.git"
  },
  "engines": {
    "vscode": "^1.85.0",
    "node": ">=20.0.0"
  },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension/extension.js",
  "contributes": {
    "commands": []
  },
  "scripts": {
    "compile": "tsc -p tsconfig.json",
    "watch": "tsc -watch -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test:dispatch": "mocha --require ts-node/register 'test/dispatch/**/*.test.ts'",
    "test": "npm run test:dispatch",
    "package": "vsce package",
    "vscode:prepublish": "npm run compile"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vscode/test-electron": "^2.3.0",
    "eslint": "^8.0.0",
    "mocha": "^10.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.3.0"
  },
  "dependencies": {}
}
EOF
  echo "   ✓ package.json written"
else
  echo "   ↷ package.json already exists — skipped"
fi

# ─── STEP 10: GitHub Actions CI ──────────────────────────────────────────────
echo "▶ Step 10: Writing .github/workflows/ci.yml..."

if [ ! -f "$REPO_ROOT/.github/workflows/ci.yml" ]; then
cat > "$REPO_ROOT/.github/workflows/ci.yml" << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Lint, Typecheck & Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test dispatch module (outside extension host)
        run: npm run test:dispatch

      # This step intentionally runs tests WITHOUT the VS Code extension host.
      # If test:dispatch fails because of a vscode import in src/dispatch/,
      # that is correct behaviour — fix the import, not the test.
EOF
  echo "   ✓ .github/workflows/ci.yml written"
else
  echo "   ↷ .github/workflows/ci.yml already exists — skipped"
fi

# ─── STEP 11: PR and Issue templates ─────────────────────────────────────────
echo "▶ Step 11: Writing GitHub templates..."

cat > "$REPO_ROOT/.github/PULL_REQUEST_TEMPLATE.md" << 'EOF'
## What does this PR do?

<!-- Brief description of the change -->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run test:dispatch` passes
- [ ] No `vscode` imports in `src/dispatch/`
- [ ] All new profile templates include `author-role:` field
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] NOTICE.md updated (if new attribution required)
EOF

cat > "$REPO_ROOT/.github/ISSUE_TEMPLATE/bug.md" << 'EOF'
---
name: Bug report
about: Something is broken
labels: bug
---

**Describe the bug**

**Steps to reproduce**

**Expected behaviour**

**Actual behaviour**

**Environment**
- docwright version:
- VSCodium version:
- OS:
EOF

cat > "$REPO_ROOT/.github/ISSUE_TEMPLATE/feature.md" << 'EOF'
---
name: Feature request
about: Propose a new feature or improvement
labels: enhancement
---

**What problem does this solve?**

**Proposed solution**

**Alternatives considered**

**Which profile(s) does this affect?**
EOF

cat > "$REPO_ROOT/.github/ISSUE_TEMPLATE/profile.md" << 'EOF'
---
name: New profile submission
about: Propose a new bundled profile
labels: profile
---

**Profile name**

**Domain it serves**

**Document types and lifecycle states**

**Why should this be bundled vs. user-defined?**

**Draft profile.json**

```json
```
EOF

echo "   ✓ GitHub templates written"

# ─── STEP 12: Source stubs ───────────────────────────────────────────────────
echo "▶ Step 12: Writing TypeScript source stubs..."

cat > "$REPO_ROOT/src/extension/extension.ts" << 'EOF'
/**
 * docwright — VSCodium Extension Entry Point
 *
 * This file is the only place where VS Code API imports are permitted
 * at the top level. All business logic lives in src/dispatch/ which
 * must have ZERO VS Code API dependencies.
 *
 * See CONTRIBUTING.md and CLAUDE.md for the architectural invariants.
 */
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('docwright: activating...');

  // TODO Phase 1: Load profile engine from dispatch module
  // TODO Phase 1: Spawn opencode serve child process
  // TODO Phase 1: Register scaffolding commands
  // TODO Phase 1: Register inbox capture command
  // TODO Phase 1: Launch web UI server

  console.log('docwright: active');
}

export function deactivate(): void {
  // TODO Phase 1: Clean up child processes (opencode serve, web UI server)
}
EOF

cat > "$REPO_ROOT/src/dispatch/index.ts" << 'EOF'
/**
 * docwright — Dispatch Module
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NO IMPORTS FROM 'vscode' ALLOWED IN THIS DIRECTORY         ║
 * ║  This module runs identically in:                           ║
 * ║    1. VSCodium extension host                               ║
 * ║    2. Standalone Node process (CLI / test harness)          ║
 * ║    3. Remote team daemon (Phase B+)                         ║
 * ║  If you need VS Code APIs, do it in src/extension/ only.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * The dispatch module is the surface-agnostic governance engine.
 * All state lives in frontmatter and index.json — never in memory
 * between calls.
 */

// Barrel export — add modules here as they are implemented
// export * from './profile';
// export * from './linter';
// export * from './templates';
// export * from './wikilinks';
// export * from './promote';
// export * from './acl';
// export * from './inbox';
// export * from './llmwiki';

export const DISPATCH_VERSION = '0.0.1';
EOF

echo "   ✓ src/extension/extension.ts written"
echo "   ✓ src/dispatch/index.ts written"

# ─── STEP 13: Test stub ──────────────────────────────────────────────────────
echo "▶ Step 13: Writing dispatch test stub..."

cat > "$REPO_ROOT/test/dispatch/dispatch.test.ts" << 'EOF'
/**
 * Dispatch module tests — run OUTSIDE the VS Code extension host.
 *
 * This test suite deliberately runs without the VS Code runtime.
 * If any test here fails because of a missing 'vscode' module,
 * that means a prohibited import crept into src/dispatch/.
 * Fix the import — do not add vscode to the test environment.
 */
import assert from 'assert';

describe('Dispatch module', () => {
  it('loads without any vscode dependency', async () => {
    // Dynamic import — if this throws "Cannot find module 'vscode'",
    // there is a prohibited import in src/dispatch/index.ts or its deps.
    const dispatch = await import('../../src/dispatch/index');
    assert.ok(dispatch, 'dispatch module should load');
  });

  it('exports DISPATCH_VERSION', async () => {
    const { DISPATCH_VERSION } = await import('../../src/dispatch/index');
    assert.ok(typeof DISPATCH_VERSION === 'string', 'should export version string');
    assert.ok(DISPATCH_VERSION.length > 0, 'version should not be empty');
  });
});
EOF

echo "   ✓ test/dispatch/dispatch.test.ts written"

# ─── STEP 14: Profile stubs ──────────────────────────────────────────────────
echo "▶ Step 14: Writing profile stubs..."

# org-operations profile.json
cat > "$REPO_ROOT/src/profiles/org-operations/profile.json" << 'EOF'
{
  "docwrightProfileVersion": "1",
  "name": "org-operations",
  "displayName": "Org Operations",
  "description": "Organizational operating system. Policy as the foundation of all work.",
  "version": "0.1.0",
  "documentTypes": ["inbox", "issue", "proposal", "plan", "policy", "decision", "work-item"],
  "states": {
    "policy":    ["draft", "active", "superseded", "archived"],
    "proposal":  ["inbox", "triaged", "evaluated", "accepted", "rejected"],
    "plan":      ["draft", "active", "completed", "canceled"],
    "issue":     ["inbox", "triaged", "resolved", "declined"],
    "decision":  ["draft", "final"],
    "work-item": ["backlog", "active", "done", "canceled"],
    "inbox":     ["new", "triaged"]
  },
  "requiredFrontmatter": ["type", "status", "created", "author", "author-role"],
  "optionalFrontmatter": ["parent", "policy-area", "tags", "origin", "ai-last-action"],
  "features": {
    "wikilinks": true,
    "graph": true,
    "naming": true,
    "llmWiki": false
  }
}
EOF

# doc-lifecycle profile.json
cat > "$REPO_ROOT/src/profiles/doc-lifecycle/profile.json" << 'EOF'
{
  "docwrightProfileVersion": "1",
  "name": "doc-lifecycle",
  "displayName": "Doc Lifecycle",
  "description": "Proposal → Plan → Completed/Canceled. Developer-focused document workflow.",
  "version": "0.1.0",
  "documentTypes": ["proposal", "plan", "sop"],
  "states": {
    "proposal": ["proposal", "plan", "completed", "canceled"]
  },
  "requiredFrontmatter": ["title", "status", "created", "author", "author-role"],
  "features": {
    "wikilinks": true,
    "graph": false,
    "naming": false,
    "llmWiki": false
  }
}
EOF

# infra-topology profile.json
cat > "$REPO_ROOT/src/profiles/infra-topology/profile.json" << 'EOF'
{
  "docwrightProfileVersion": "1",
  "name": "infra-topology",
  "displayName": "Infra Topology",
  "description": "Network/device/service lifecycle: Planned → Active → Decommissioned.",
  "version": "0.1.0",
  "documentTypes": ["device", "service", "network-segment"],
  "states": {
    "default": ["planned", "active", "decommissioned"]
  },
  "requiredFrontmatter": ["title", "type", "status", "hostname", "author-role"],
  "features": {
    "wikilinks": true,
    "graph": true,
    "naming": true,
    "llmWiki": false
  }
}
EOF

# knowledge-base profile.json
cat > "$REPO_ROOT/src/profiles/knowledge-base/profile.json" << 'EOF'
{
  "docwrightProfileVersion": "1",
  "name": "knowledge-base",
  "displayName": "Knowledge Base",
  "description": "Karpathy LLM Wiki pattern with docwright governance. Ingest → Lint → Save-to-Wiki.",
  "version": "0.1.0",
  "documentTypes": ["source", "concept", "entity", "comparison", "exploration"],
  "states": {
    "source": ["inbox", "compiled", "verified", "archived"]
  },
  "requiredFrontmatter": ["title", "type", "author-role"],
  "optionalFrontmatter": ["status", "tags", "confidence", "aliases", "source_url", "ai-last-action"],
  "features": {
    "wikilinks": true,
    "graph": true,
    "naming": false,
    "llmWiki": true
  }
}
EOF

echo "   ✓ Profile stubs written (org-operations, doc-lifecycle, infra-topology, knowledge-base)"

# ─── STEP 15: Example vault README ───────────────────────────────────────────
echo "▶ Step 15: Writing example-vault/README.md..."

cat > "$REPO_ROOT/example-vault/README.md" << 'EOF'
# docwright Example Vault

This is the generic starter vault for the `org-operations` profile.
It shows the structure and document formats for a new docwright deployment.

## How to start

1. Copy this folder into your own repository
2. Write your organization's mission in `policies/core/mission.md` — that's the root node everything else traces back to
3. Add program-area policies under `policies/program-areas/` — one per major activity domain
4. Submit your first real inbox item via the web form or `docwright capture "your idea"`

## What to write first

`policies/core/mission.md` — one or two sentences of purpose.
Everything in docwright traces back to this document.
Without it, the AI triage layer has no foundation to work from.

## Questions?

See `PROJECT.md` in the repo root for the full architecture specification,
or join the discussion at https://github.com/growlf/docwright

## Reference implementation

Cascade STEAM's deployment of docwright is the reference implementation.
See `cascade-steam-vault-seed.md` in the repo root for a real-world example
of all document types fully populated.
EOF

echo "   ✓ example-vault/README.md written"

# ─── STEP 16: Example vault stub documents ───────────────────────────────────
echo "▶ Step 16: Writing example-vault stub documents..."

cat > "$REPO_ROOT/example-vault/policies/core/mission.md" << 'EOF'
---
type: policy
status: draft
created: YYYY-MM-DD
author: your-name
author-role: governance
policy-area: core
---

# Mission

## Statement

*[YOUR MISSION STATEMENT HERE — one or two sentences of purpose]*

## Context

*[2-3 sentences explaining the problem your organization exists to solve
and the community or population you serve]*

## Scope

This mission governs all programs, events, decisions, and partnerships.
Any proposal that cannot be traced back to this mission should be questioned.

## Related

- [[policies/core/vision.md]]
- [[policies/core/values.md]]
- [[policies/core/governance.md]]
EOF

cat > "$REPO_ROOT/example-vault/policies/core/values.md" << 'EOF'
---
type: policy
status: draft
created: YYYY-MM-DD
author: your-name
author-role: governance
policy-area: core
---

# Values

Values are the non-negotiables. When a proposal seems beneficial but conflicts
with a value, the value wins.

## [Value 1 Name]

*[One paragraph describing this value and what it means in practice]*

*Implication for proposals:* [What kinds of proposals conflict with this value]

## [Value 2 Name]

*[One paragraph]*

*Implication for proposals:* [What kinds of proposals conflict with this value]

## [Value 3 Name]

*[One paragraph]*

*Implication for proposals:* [What kinds of proposals conflict with this value]

## Related

- [[policies/core/mission.md]]
- [[policies/core/governance.md]]
EOF

cat > "$REPO_ROOT/example-vault/policies/program-areas/example-area.md" << 'EOF'
---
type: policy
status: draft
created: YYYY-MM-DD
author: your-name
author-role: governance
policy-area: program-areas
---

# Policy Area: [Area Name]

## Purpose

*[One paragraph: what activity cluster does this policy area govern?
What programs or projects live under it?]*

## Current programs in this area

- **[Program Name]** — [one sentence description]
- **[Program Name]** — [one sentence description]

## Policy principles

- *[Principle 1 — a non-negotiable for this area]*
- *[Principle 2]*
- *[Principle 3]*

## Related decisions

*[No decisions recorded yet — this will populate as issues are triaged
and proposals are evaluated against this policy area.]*
EOF

cat > "$REPO_ROOT/example-vault/inbox/INX-0000.md" << 'EOF'
---
type: inbox
status: new
created: YYYY-MM-DD
origin: web-form
author: anonymous
author-role: observer
---

# [Idea or observation title]

[The raw idea, annoyance, question, or "what if..." — no structure required.
This is zero-friction capture. The AI triage step will add structure.]
EOF

cat > "$REPO_ROOT/example-vault/issues/ISS-0000.md" << 'EOF'
---
type: issue
status: triaged
created: YYYY-MM-DD
parent: inbox/INX-0000.md
policy-area: policies/program-areas/example-area.md
author: your-name
author-role: contributor
ai-last-action: triage YYYY-MM-DD docwright v0.1.0
---

# Issue: [Issue title]

## Summary

[1-2 sentences summarizing what the issue is about]

## AI triage notes

**Policy area:** [[policies/program-areas/example-area.md]]

**Related prior decisions:** [None found / link to relevant decisions]

**Potential conflicts:** [None identified / describe any]

## Status

Triaged. Ready for a Contributor or Steward to evaluate and draft a Proposal,
or to decline with a Decision record explaining why not.

## Related

- [[inbox/INX-0000.md]] — originating inbox item
EOF

cat > "$REPO_ROOT/example-vault/proposals/PRP-0000.md" << 'EOF'
---
type: proposal
status: evaluated
created: YYYY-MM-DD
parent: issues/ISS-0000.md
policy-area: policies/program-areas/example-area.md
author: your-name
author-role: contributor
---

# Proposal: [Proposal title]

## Problem

[What problem does this proposal solve? Why does it matter?]

## Proposed approach

[What are you proposing to do? Be specific enough that someone could act on it.]

## Alignment with policy

- [[policies/core/mission.md]] — [how it aligns] ✅
- [[policies/core/values.md]] — [which values it upholds] ✅
- [[policies/program-areas/example-area.md]] — [how it fits] ✅

## Risks and open questions

- [Risk 1]
- [Open question 1]

## Recommendation

[Proceed / Defer / Decline — and why]

## Related

- [[issues/ISS-0000.md]] — originating issue
EOF

cat > "$REPO_ROOT/example-vault/decisions/DEC-0000.md" << 'EOF'
---
type: decision
status: final
created: YYYY-MM-DD
parent-proposal: proposals/PRP-0000.md
policy-area: policies/program-areas/example-area.md
outcome: declined
author: your-name
author-role: governance
---

# Decision: [What was decided]

## Decision

[Accepted / Declined / Deferred] — [one sentence summary]

## Reasoning

[Why was this decision made? Which values or policies were decisive?
Cite specific policy documents using wikilinks.]

## What would change this decision

[For declined/deferred: what conditions, if met, would cause this to be revisited?
This is institutional memory — future contributors will read this.]

## Related

- [[proposals/PRP-0000.md]] — the proposal this decision responds to
- [[issues/ISS-0000.md]] — originating issue
- [[policies/program-areas/example-area.md]] — governing policy area
EOF

echo "   ✓ Example vault documents written"

# ─── STEP 17: Spike README ───────────────────────────────────────────────────
echo "▶ Step 17: Writing spike/opencode-embed/README.md..."

cat > "$REPO_ROOT/spike/opencode-embed/README.md" << 'EOF'
# Phase 0 Spike: OpenCode Embed

**Goal:** Validate that `opencode serve` can be embedded in a VSCodium WebView
before building Phase 1.

**This directory is gitignored.** Spike code is throwaway — findings go into
a decision record, not into `src/`.

## Go / No-go criteria

GO if:
- `opencode serve` exposes a stable HTTP API (documented, versioned)
- The JS SDK covers: session create, message send, response stream
- A minimal SPA loads in a VSCodium WebView pointed at localhost:PORT

NO-GO (fallback: SDK-only chat UI) if:
- The serve API is undocumented or unstable
- WebView CSP prevents loading the SPA
- Process management is too complex for Phase 1 scope

## What to build here

1. `minimal-extension/` — stripped VSCodium extension that:
   - Spawns `opencode serve --port 4096` as a child process
   - Polls the health endpoint until ready
   - Opens a WebView at `http://localhost:4096`
   - Logs whether the SPA loads and a session can be created

2. Record findings in a decision record at
   `proposals/` or `docs/decisions/` in the main repo when done.

## When done

Delete this directory. Commit the decision record. Begin Phase 1.
EOF

echo "   ✓ spike/opencode-embed/README.md written"

# ─── STEP 18: Update .gitignore ──────────────────────────────────────────────
echo "▶ Step 18: Updating .gitignore..."

# Add docwright-specific entries if not already present
GITIGNORE="$REPO_ROOT/.gitignore"
touch "$GITIGNORE"

add_if_missing() {
  local entry="$1"
  local comment="$2"
  if ! grep -qF "$entry" "$GITIGNORE"; then
    echo "" >> "$GITIGNORE"
    [ -n "$comment" ] && echo "# $comment" >> "$GITIGNORE"
    echo "$entry" >> "$GITIGNORE"
  fi
}

add_if_missing "node_modules/" "Node"
add_if_missing "dist/" "TypeScript output"
add_if_missing "*.vsix" "Extension package"
add_if_missing ".env" "Local secrets"
add_if_missing ".docworkbench/index.json" "docwright derived cache (per-user)"
add_if_missing ".docworkbench/_backlinks.json" "docwright backlinks cache (per-user)"
add_if_missing ".docworkbench/daemon.json" "docwright daemon trust config (per-instance)"
add_if_missing "spike/" "Phase 0 spike — throwaway code"
add_if_missing ".DS_Store" "macOS"
add_if_missing "*.js.map" "Source maps"

echo "   ✓ .gitignore updated"

# ─── STEP 19: Update README.md ───────────────────────────────────────────────
echo "▶ Step 19: Updating README.md..."

cat > "$REPO_ROOT/README.md" << 'EOF'
# docwright

**Organizational operating system for policy-driven teams.**

docwright is a governance layer — not an editor — that connects an organization's
values, decisions, and daily work through a policy-grounded document hierarchy.
All state lives in plain Markdown files with YAML frontmatter, in a git repository,
accessible from multiple client surfaces without vendor lock-in.

## What it is

```
Inbox (ideas, issues, observations)
  → Issues → Proposals → Plans → Policies / Decisions
                                       → Work Items → Code (OpenCode)
```

- **Web UI** — primary interface for all contributors (SvelteKit, rendered Markdown,
  AI chat panel, ACL-gated actions)
- **VSCodium extension** — power tool for developers (lifecycle enforcement, git workflow,
  OpenCode integration)
- **Logseq** — optional graph explorer (opens the same vault folder, read-only)

## Status

Pre-alpha. Phase 0 (spike) in progress.
See [PROJECT.md](./PROJECT.md) for the full architecture specification.

## Quick start (coming in Phase 1)

```bash
# Install the VSCodium extension (once published)
# Open any folder — org-operations profile activates automatically
# Ctrl+Shift+P → "docwright: New Inbox Item"
```

## For AI agents and Claude Code

See [CLAUDE.md](./CLAUDE.md) — read this first when starting a new session.
Full project context and decision log:
https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

## License

MIT — see [LICENSE](./LICENSE)
EOF

echo "   ✓ README.md updated"

# ─── STEP 20: Append to AGENTS.md ────────────────────────────────────────────
echo "▶ Step 20: Appending architectural context to AGENTS.md..."

if ! grep -q "Architectural Context" "$REPO_ROOT/AGENTS.md" 2>/dev/null; then
cat >> "$REPO_ROOT/AGENTS.md" << 'EOF'

---

## Architectural Context (added 2026-06-01)

docwright has been reframed as an **organizational operating system** — a governance
layer with multiple client surfaces. Read CLAUDE.md for full context.

### Invariants — never violate these

1. **dispatch module has zero VS Code API deps** — `src/dispatch/` must be importable
   outside the extension host. The CI pipeline enforces this via `npm run test:dispatch`.
   If you import `vscode` in `src/dispatch/`, the build breaks. Fix the import.

2. **Frontmatter is audit record, not enforcement** — `author-role:` records who did
   what. Enforcement is Forgejo team membership + branch protection + Web UI OAuth.
   Do not use `author-role:` to make permission decisions in code.

3. **Git is the canonical store** — no auxiliary database. index.json is a derived
   cache rebuilt from frontmatter. _backlinks.json is rebuilt from wikilinks.
   If these files are deleted, rebuild them — don't restore from backup.

4. **No telemetry, ever** — do not add any analytics, tracking, or phone-home code.

5. **`author-role:` field required in all templates** — every profile template must
   include `author-role:` with default value `contributor`. This is non-negotiable.
   See CONTRIBUTING.md.

### Profile structure

Profiles live in `src/profiles/[name]/` and contain:
- `profile.json` — manifest (states, document types, features, required frontmatter)
- `schema.json` — frontmatter JSON Schema for validation
- `opencode-instructions.md` — AI context injected on profile activation
- `templates/[type].md` — scaffolding templates (ALL must include `author-role:`)

### ACL model

Four tiers: Observer / Contributor / Steward / Governance
Source of truth: Forgejo team membership (not frontmatter)
Frontmatter `author-role:` is an audit record of the tier at time of action.
Web UI enforces via Forgejo OAuth + team API.
VSCodium uses `docworkbench.userRole` workspace setting (honor system for devs).
EOF
  echo "   ✓ AGENTS.md updated with architectural context"
else
  echo "   ↷ AGENTS.md already has architectural context — skipped"
fi

# ─── FINAL SUMMARY ───────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                      Setup complete                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "New files created:"
echo "  LICENSE"
echo "  CHANGELOG.md"
echo "  SECURITY.md"
echo "  CONTRIBUTING.md"
echo "  .prettierrc"
echo "  .eslintrc.json"
echo "  tsconfig.json"
echo "  package.json"
echo "  .github/workflows/ci.yml"
echo "  .github/PULL_REQUEST_TEMPLATE.md"
echo "  .github/ISSUE_TEMPLATE/{bug,feature,profile}.md"
echo "  src/extension/extension.ts"
echo "  src/dispatch/index.ts"
echo "  test/dispatch/dispatch.test.ts"
echo "  src/profiles/{org-operations,doc-lifecycle,infra-topology,knowledge-base}/profile.json"
echo "  example-vault/README.md"
echo "  example-vault/policies/core/{mission,values}.md"
echo "  example-vault/policies/program-areas/example-area.md"
echo "  example-vault/{inbox/INX-0000,issues/ISS-0000,proposals/PRP-0000,decisions/DEC-0000}.md"
echo "  spike/opencode-embed/README.md"
echo ""
echo "Updated files:"
echo "  README.md"
echo "  .gitignore"
echo "  AGENTS.md (appended architectural context)"
echo ""
echo "Skipped (already existed with content):"
echo "  Any file that already existed — this script never overwrites"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. npm run typecheck    (should pass cleanly)"
echo "  3. npm run test:dispatch (should pass — one placeholder test)"
echo "  4. Review the changes"
echo "  5. git add -A"
echo "  6. git commit -m 'chore: establish project structure and Phase 0 scaffold'"
echo "  7. git push"
echo ""
echo "Then: begin Phase 0 spike in spike/opencode-embed/"
echo "      Read spike/opencode-embed/README.md for the go/no-go criteria"
echo ""
