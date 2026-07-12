#!/bin/bash
# harden-plan-proposal-lifecycle-tooling step 3.1 — validate_location_invariant
# must scope its approved:/status: checks to the YAML frontmatter block only.
# A body line beginning with `status:`/`approved:` (e.g. inside a fenced code
# block) previously false-triggered the whole-file grep and blocked the commit.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
git init -q
git config user.name "Hook Test"; git config user.email "hooktest@example.com"
git config commit.gpgsign false
git config core.hooksPath .git/hooks
mkdir -p .git/hooks plans/completed
cp "$REPO/scripts/pre-commit.sh" .git/hooks/pre-commit
cp "$REPO/scripts/commit-msg.sh" .git/hooks/commit-msg 2>/dev/null || true
chmod +x .git/hooks/pre-commit

# A completed plan whose BODY contains, in a fenced code block, lines that begin
# with `status:` and `approved:` — legitimate prose/example content.
cat > plans/completed/loc-test.md <<'EOF'
---
title: "Location Invariant Test"
status: completed
author: Hook Test
created: 2026-07-06
author-role: contributor
tags:
  - test
---

## Example frontmatter (documentation)

```yaml
status: draft
approved: false
```

Body text mentioning status: draft inline as well.
EOF

# 1. REGRESSION: body `status:`/`approved:` lines must NOT trip the invariant.
git add -A
if git commit -qm "docs: completed plan with status in body prose" 2>/dev/null; then
  ok "body status:/approved: lines do not false-trigger the location invariant"
else
  err "FALSE POSITIVE: body prose tripped validate_location_invariant (the 3.1 bug)"
fi

# 2. ENFORCEMENT PRESERVED: a real frontmatter status must still be validated.
cat > plans/completed/bad.md <<'EOF'
---
title: "Bad Completed"
status: draft
author: Hook Test
created: 2026-07-06
author-role: contributor
tags:
  - test
---

body
EOF
git add -A
if git commit -qm "docs: completed-dir plan with frontmatter status draft" 2>/dev/null; then
  err "location invariant did NOT block a plans/completed/ file with frontmatter status: draft"
  git reset -q --hard HEAD~1 2>/dev/null || true
else
  ok "frontmatter status: draft in plans/completed/ still blocked (enforcement intact)"
fi

[ $FAIL -eq 0 ] && echo -e "${GREEN}test-location-invariant-frontmatter: PASS${NC}" || echo -e "${RED}test-location-invariant-frontmatter: FAIL${NC}"
exit $FAIL
