#!/bin/bash
# #140 — moving a proposal into proposals/approved/ (or adding one born
# approved) is an approval and must carry the HUMAN-APPROVED seal, exactly
# like flipping `approved:` in place. Edits to already-approved proposals
# need no seal.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export NODE_PATH="$REPO/node_modules"
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
mkdir -p .git/hooks proposals/approved
cp "$REPO/scripts/pre-commit.sh" .git/hooks/pre-commit
cp "$REPO/scripts/commit-msg.sh" .git/hooks/commit-msg
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg

prop() { printf -- '---\ntitle: "P"\napproved: %s\nauthor: Hook Test\ncreated: 2026-07-06\ntags:\n  - test\nassigned_to: "T"\nauthor-role: contributor\ncreated_by: "Hook Test@test"\n---\n\nbody\n' "$1"; }

# Seed: unapproved proposal at root
prop false > proposals/p.md
git add -A && git commit -qm "docs: seed" || { err "seed commit failed"; exit 1; }

# 1. Move + flip WITHOUT seal → rejected
git mv proposals/p.md proposals/approved/p.md
prop true > proposals/approved/p.md
git add -A
if git commit -qm "docs: sneak approval by move" 2>/dev/null; then
  err "approve-by-move WITHOUT seal was accepted"
  git reset -q --hard HEAD~1
else
  ok "approve-by-move without seal rejected"
  # 2. Same move WITH the seal → accepted
  if git commit -qm "$(printf 'docs: approve p (proposal moved)\n\nHUMAN-APPROVED:p')" 2>/dev/null; then
    ok "approve-by-move with HUMAN-APPROVED seal accepted"
  else
    err "legitimate sealed approval-by-move rejected"
  fi
fi

# 3. Edit an ALREADY-approved proposal → no seal needed
printf '\nmore body\n' >> proposals/approved/p.md
git add -A
git commit -qm "docs: expand approved proposal" 2>/dev/null \
  && ok "edit to already-approved proposal needs no seal" \
  || { err "edit to already-approved proposal wrongly gated"; git reset -q HEAD; }

# 4. Brand-new root proposal born approved: true WITHOUT seal → rejected
prop true > proposals/born.md
git add proposals/born.md
if git commit -qm "docs: new proposal born approved" 2>/dev/null; then
  err "born-approved root proposal accepted without seal"
else
  ok "born-approved root proposal rejected without seal"
fi

exit $FAIL
