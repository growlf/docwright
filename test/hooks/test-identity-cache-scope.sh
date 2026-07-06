#!/bin/bash
# #160 — the identity cache must be per-repo. A test fixture resolving its
# identity must never poison another repo's commit banner (the old global
# /tmp/opencode-identity-cache did exactly that, for an hour, repeatedly).
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export NODE_PATH="$REPO/node_modules"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

make_repo() {  # $1 dir, $2 name, $3 email
  mkdir -p "$1" && cd "$1"
  git init -q
  git config user.name "$2"; git config user.email "$3"
  git config commit.gpgsign false
  git config core.hooksPath .git/hooks
  mkdir -p .git/hooks
  cp "$REPO/scripts/pre-commit.sh" .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  printf 'OPCODE_USER_NAME="%s"\nOPCODE_USER_EMAIL="%s"\n' "$2" "$3" > .env
}

banner_of() {  # run the hook on an empty stage, capture the identity line
  bash .git/hooks/pre-commit 2>&1 | grep -m1 'Human:'
}

make_repo "$WORK/repo-a" "Alpha Tester" "alpha@example.com"
A=$(banner_of)
echo "$A" | grep -q 'Alpha Tester' && ok "repo A resolves its own identity" || err "repo A banner wrong: $A"

make_repo "$WORK/repo-b" "Beta Tester" "beta@example.com"
B=$(banner_of)
echo "$B" | grep -q 'Beta Tester' && ok "repo B unaffected by repo A's cache" \
  || err "repo B poisoned by repo A: $B"

# Cache lives under each repo's .git, not /tmp
[ -f "$WORK/repo-a/.git/docwright-identity-cache" ] && ok "repo A cache under its .git/" || err "repo A cache not in .git/"
[ -f "$WORK/repo-b/.git/docwright-identity-cache" ] && ok "repo B cache under its .git/" || err "repo B cache not in .git/"
grep -q 'CACHE_FILE="/tmp/opencode-identity-cache"' "$REPO/scripts/pre-commit.sh" \
  && err "global /tmp identity cache path still present in canonical source" \
  || ok "no global /tmp identity cache path in canonical source"

exit $FAIL
