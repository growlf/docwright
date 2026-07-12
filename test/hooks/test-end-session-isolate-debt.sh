#!/bin/bash
# harden-plan-proposal-lifecycle-tooling step 4.1 — end-session must not abort
# the whole shutdown (losing the session note) when the working tree contains
# validation debt UNRELATED to this session. It should isolate: commit the
# session note + SESSION-LOG, and REPORT the unrelated debt for manual review.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

git init -q -b main "$WORK/vault"
cd "$WORK/vault"
git config user.name "Session Test"; git config user.email "session@example.com"
git config commit.gpgsign false
git config core.hooksPath .git/hooks
# Install the REAL DocWright pre-commit hook (the source of the abort).
cp "$REPO/scripts/pre-commit.sh" .git/hooks/pre-commit
cp "$REPO/scripts/commit-msg.sh" .git/hooks/commit-msg 2>/dev/null || true
chmod +x .git/hooks/pre-commit
echo "0.9.9" > VERSION
printf '# log\n\n## Session: 2026-07-05 — seed\n' > SESSION-LOG.md
mkdir -p plans docs/session-notes issues
git add -A && git commit -qm "chore: seed" >/dev/null 2>&1 || { err "seed commit failed"; exit 1; }

# Pre-existing, UNRELATED validation debt: an issue with a bogus status that the
# pre-commit hook rejects. Left dirty so end-session's `git add -A` sweeps it in.
cat > issues/unrelated-debt.md <<'EOF'
---
title: "Unrelated debt"
status: bogus-not-a-real-status
author: Test
created: 2026-07-05
author-role: user
category: bug
---
Pre-existing debt — not this session's work.
EOF

out=$(cd "$REPO" && DW_SESSION_ROOT="$WORK/vault" npx tsx scripts/end-session.ts \
  --no-push --defer-phase-close --since 2026-07-05 --focus "isolate debt" --summary "test" 2>&1)
rc=$?

cd "$WORK/vault"
[ $rc -eq 0 ] && ok "end-session exits 0 despite unrelated validation debt" || { err "exit=$rc"; echo "$out" | tail -20; }

if git log -1 --name-only --format= 2>/dev/null | grep -q "docs/session-notes/session_note_"; then
  ok "session note committed in isolation"
else
  err "session note NOT committed (shutdown lost the note)"; echo "$out" | tail -20
fi

# -uall expands untracked dirs (git collapses a fully-untracked dir to '?? issues/')
if git status --porcelain -uall | grep -q "issues/unrelated-debt.md" \
   && ! git log -1 --name-only --format= | grep -q "issues/unrelated-debt.md"; then
  ok "unrelated debt left uncommitted for manual review"
else
  err "unrelated debt was committed (should have been isolated out)"
fi

[ $FAIL -eq 0 ] && echo -e "${GREEN}test-end-session-isolate-debt: PASS${NC}" || echo -e "${RED}test-end-session-isolate-debt: FAIL${NC}"
exit $FAIL
