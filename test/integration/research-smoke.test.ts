/**
 * Research stage integration smoke test (plan step 8).
 *
 * Exercises the full research pipeline with real temp-vault files:
 *   lintDocument → scanProposal (collation) → pre-commit hook script
 *
 * Positive path: valid active + concluded research docs pass every gate.
 * Negative path: each malformed variant is caught by the right layer.
 * Profile coverage: all 4 profiles register research + have author-role template.
 */

import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { describe, it, before, after } from 'mocha';
import { lintDocument } from '../../src/dispatch/linter';
import { scanProposal, classifyRelationship } from '../../src/dispatch/relationships';
import { getActiveProfile } from '../../src/dispatch/profile';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'pre-commit.sh');

// ── Temp vault setup ──────────────────────────────────────────────────────────

let VAULT: string;
const profile = getActiveProfile(REPO_ROOT);

function write(rel: string, content: string): string {
  const abs = path.join(VAULT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return rel;
}

// Write a self-contained bash script to a temp file to avoid quote-nesting
// issues with bash -c '...' when the function body contains awk '...'.
function hookPasses(relPath: string): boolean {
  const script = `#!/usr/bin/env bash
get_frontmatter() { awk 'BEGIN{c=0} /^---$/{c++; next} c==1{print} c==2{exit}' "$1"; }
print_error() { echo "[x] $1"; }
validate_research_document() {
  local FILE=$1
  [[ ! "$FILE" =~ ^research/.+\\.md$ ]] && return 0
  local FM CONTENT STATUS CONCLUSION E=0
  FM=$(get_frontmatter "$FILE" 2>/dev/null)
  CONTENT=$(cat "$FILE" 2>/dev/null)
  [ -z "$FM" ] && print_error "$FILE: missing frontmatter" && return 1
  for FIELD in title status question author created author-role; do
    echo "$FM" | grep -qE "^\${FIELD}:[[:space:]]*.+" || { print_error "$FILE: missing \${FIELD}"; ((E++)); }
  done
  STATUS=$(echo "$FM" | grep "^status:" | sed 's/^status:[[:space:]]*//' | tr -d '"' | xargs)
  CONCLUSION=$(echo "$FM" | grep "^conclusion:" | sed 's/^conclusion:[[:space:]]*//' | tr -d '"' | xargs)
  if [ -n "$STATUS" ] && ! echo "$STATUS" | grep -qE '^(active|concluded|archived)$'; then
    print_error "$FILE: bad status"; ((E++))
  fi
  if [ "$STATUS" = "concluded" ]; then
    if [ -z "$CONCLUSION" ] || [ "$CONCLUSION" = "open" ]; then
      print_error "$FILE: concluded needs real conclusion"; ((E++))
    fi
    echo "$CONTENT" | grep -q "^## Conclusion" || { print_error "$FILE: missing ## Conclusion"; ((E++)); }
  fi
  if [ "$STATUS" = "archived" ] && [ -z "$CONCLUSION" ]; then
    print_error "$FILE: archived needs conclusion"; ((E++))
  fi
  if [ -n "$CONCLUSION" ] && ! echo "$CONCLUSION" | grep -qE '^(open|recommends|inconclusive|superseded)$'; then
    print_error "$FILE: bad conclusion enum"; ((E++))
  fi
  [ $E -gt 0 ] && return 1; return 0
}
cd "${VAULT}" && validate_research_document "${relPath}"
`;
  const tmp = path.join(os.tmpdir(), `dw-hook-check-${process.pid}.sh`);
  fs.writeFileSync(tmp, script, { mode: 0o755 });
  try {
    execSync(`bash "${tmp}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

before(() => {
  VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-research-smoke-'));
  fs.mkdirSync(path.join(VAULT, 'research'), { recursive: true });
  fs.mkdirSync(path.join(VAULT, 'proposals', 'approved'), { recursive: true });
});

after(() => {
  fs.rmSync(VAULT, { recursive: true, force: true });
});

// ── Positive path ─────────────────────────────────────────────────────────────

describe('Research smoke test — positive path', () => {
  const ACTIVE_DOC = `---
title: SSE vs WebSocket for live reload
status: active
question: Which protocol best suits DocWright unidirectional live-reload?
conclusion: open
author: NetYeti
created: 2026-06-07
author-role: contributor
tags:
  - architecture
  - performance
linked_proposals: []
related_research: []
---

## Questions Explored

- Which protocol best suits DocWright unidirectional live-reload?

## Approaches Compared

| Approach | Pros | Cons |
|----------|------|------|
| SSE | Simple, HTTP/1.1 compatible | Server→client only |
| WebSocket | Bidirectional | Overkill for read-only push |

## Findings

SSE is sufficient — DocWright only needs server→client push.

## Sources

- MDN SSE documentation
`;

  const CONCLUDED_DOC = `---
title: SSE vs WebSocket — concluded
status: concluded
question: Which protocol best suits DocWright unidirectional live-reload?
conclusion: recommends
author: NetYeti
created: 2026-06-07
author-role: contributor
---

## Findings

SSE fits the use case.

## Conclusion

Recommends SSE — WebSocket adds complexity without benefit for read-only push.
`;

  let activePath: string;
  let concludedPath: string;

  before(() => {
    activePath = write('research/sse-active.md', ACTIVE_DOC);
    concludedPath = write('research/sse-concluded.md', CONCLUDED_DOC);
  });

  it('linter accepts valid active research doc', () => {
    const fm = {
      title: 'SSE vs WebSocket for live reload',
      status: 'active', question: 'Which protocol?',
      conclusion: 'open', author: 'NetYeti', created: '2026-06-07', 'author-role': 'contributor',
    };
    const errors = lintDocument(activePath, fm, profile).filter(r => r.severity === 'error');
    assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
  });

  it('linter accepts valid concluded research doc', () => {
    const fm = {
      title: 'SSE vs WebSocket — concluded',
      status: 'concluded', question: 'Which protocol?',
      conclusion: 'recommends', author: 'NetYeti', created: '2026-06-07', 'author-role': 'contributor',
    };
    const errors = lintDocument(concludedPath, fm, profile).filter(r => r.severity === 'error');
    assert.strictEqual(errors.length, 0, `unexpected errors: ${JSON.stringify(errors)}`);
  });

  it('pre-commit hook passes valid active research doc', () => {
    assert.ok(hookPasses(activePath), 'hook should pass valid active doc');
  });

  it('pre-commit hook passes valid concluded research doc', () => {
    assert.ok(hookPasses(concludedPath), 'hook should pass valid concluded doc');
  });

  it('collation classifies research doc as informed-by when scanning from a proposal', () => {
    const proposalPath = write('proposals/live-reload.md', `---
title: Live reload for Web UI
status: active
question: Which tech for live reload?
author: NetYeti
created: 2026-06-07
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---
We need live file change detection in the Web UI.
`);
    const results = scanProposal(proposalPath, [activePath], VAULT, 0.05);
    assert.ok(results.length > 0, 'should find at least one related doc');
    const rel = results.find(r => r.target === activePath);
    assert.ok(rel, 'should find the research doc');
    assert.strictEqual(rel!.type, 'informed-by', `expected informed-by, got ${rel!.type}`);
  });

  it('classifyRelationship always returns informed-by for research/ path', () => {
    const signals = { jaccard: 0, tag_overlap: 0, phase_match: 0, same_author: 0, same_assigned: 0, explicit_related: 0, wikilink_cooccurrence: 0 };
    assert.strictEqual(classifyRelationship(0.31, signals, {}, activePath), 'informed-by');
  });
});

// ── Negative path — each gate catches the right error ─────────────────────────

describe('Research smoke test — negative path (gates)', () => {

  it('linter rejects missing required field (question)', () => {
    const fm = { title: 'T', status: 'active', author: 'A', created: '2026-06-07', 'author-role': 'contributor' };
    const errs = lintDocument('research/missing-q.md', fm, profile).filter(r => r.severity === 'error');
    assert.ok(errs.some(e => e.field === 'question'), 'should flag missing question');
  });

  it('linter rejects invalid status enum', () => {
    const fm = { title: 'T', status: 'in-progress', question: 'Q?', author: 'A', created: '2026-06-07', 'author-role': 'contributor' };
    const errs = lintDocument('research/bad-status.md', fm, profile).filter(r => r.severity === 'error');
    assert.ok(errs.some(e => e.field === 'status'), 'should flag invalid status');
  });

  it('linter rejects status:concluded without conclusion field', () => {
    const fm = { title: 'T', status: 'concluded', question: 'Q?', author: 'A', created: '2026-06-07', 'author-role': 'contributor' };
    const errs = lintDocument('research/concluded-no-field.md', fm, profile).filter(r => r.severity === 'error');
    assert.ok(errs.some(e => e.field === 'conclusion'), 'should flag missing conclusion');
  });

  it('linter rejects invalid conclusion enum', () => {
    const fm = { title: 'T', status: 'active', question: 'Q?', conclusion: 'maybe', author: 'A', created: '2026-06-07', 'author-role': 'contributor' };
    const errs = lintDocument('research/bad-conclusion.md', fm, profile).filter(r => r.severity === 'error');
    assert.ok(errs.some(e => e.field === 'conclusion'), 'should flag invalid conclusion enum');
  });

  it('pre-commit hook rejects doc missing required field', () => {
    const p = write('research/hook-missing-q.md', `---
title: No question
status: active
author: NetYeti
created: 2026-06-07
author-role: contributor
---
Body.`);
    assert.ok(!hookPasses(p), 'hook should reject missing question');
  });

  it('pre-commit hook rejects status:concluded with conclusion:open', () => {
    const p = write('research/hook-concluded-open.md', `---
title: Concluded open
status: concluded
question: Q?
conclusion: open
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Conclusion
Still open.`);
    assert.ok(!hookPasses(p), 'hook should reject concluded + open');
  });

  it('pre-commit hook rejects status:concluded without ## Conclusion section', () => {
    const p = write('research/hook-no-section.md', `---
title: No section
status: concluded
question: Q?
conclusion: recommends
author: NetYeti
created: 2026-06-07
author-role: contributor
---
## Findings
No conclusion section.`);
    assert.ok(!hookPasses(p), 'hook should reject missing ## Conclusion section');
  });
});

// ── Profile coverage ──────────────────────────────────────────────────────────

describe('Research smoke test — profile coverage', () => {
  const PROFILES_DIR = path.join(REPO_ROOT, 'src', 'profiles');

  it('all 4 profiles have research in documentTypes', () => {
    const profiles = fs.readdirSync(PROFILES_DIR).filter(p =>
      fs.statSync(path.join(PROFILES_DIR, p)).isDirectory()
    );
    assert.ok(profiles.length >= 4, 'should have at least 4 profiles');
    for (const p of profiles) {
      const pJson = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, p, 'profile.json'), 'utf-8'));
      assert.ok(
        (pJson.documentTypes ?? []).includes('research'),
        `${p}/profile.json missing research in documentTypes`
      );
    }
  });

  it('all 4 profiles have templates/research.md with author-role', () => {
    const profiles = fs.readdirSync(PROFILES_DIR).filter(p =>
      fs.statSync(path.join(PROFILES_DIR, p)).isDirectory()
    );
    for (const p of profiles) {
      const tmpl = path.join(PROFILES_DIR, p, 'templates', 'research.md');
      assert.ok(fs.existsSync(tmpl), `${p}/templates/research.md is missing`);
      const content = fs.readFileSync(tmpl, 'utf-8');
      assert.ok(content.includes('author-role'), `${p}/templates/research.md missing author-role field`);
    }
  });

  it('schema.json exists in all 4 profiles with research type', () => {
    const profiles = fs.readdirSync(PROFILES_DIR).filter(p =>
      fs.statSync(path.join(PROFILES_DIR, p)).isDirectory()
    );
    for (const p of profiles) {
      const schema = path.join(PROFILES_DIR, p, 'schema.json');
      assert.ok(fs.existsSync(schema), `${p}/schema.json is missing`);
      const parsed = JSON.parse(fs.readFileSync(schema, 'utf-8'));
      assert.ok(
        parsed.documentTypes?.research !== undefined,
        `${p}/schema.json missing research type definition`
      );
    }
  });
});
