#!/bin/bash
# #146 — end-session must auto-land protected-main commits via a PR branch
# (branch → push → gh pr create + merge --auto → reset main) instead of
# stranding them with manual instructions.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Bare "origin" whose pre-receive rejects pushes to main (simulates protection)
git init -q --bare "$WORK/origin.git"
cat > "$WORK/origin.git/hooks/pre-receive" <<'EOF'
#!/bin/bash
while read old new ref; do
  [ "$ref" = "refs/heads/main" ] && [ "$old" != "0000000000000000000000000000000000000000" ] \
    && { echo "protected branch hook declined" >&2; exit 1; }
done
exit 0
EOF
chmod +x "$WORK/origin.git/hooks/pre-receive"

# Fixture vault clone
git init -q -b main "$WORK/vault"
cd "$WORK/vault"
git config user.name "Session Test"; git config user.email "session@example.com"
git config commit.gpgsign false
git config core.hooksPath .git/hooks   # no DocWright hooks in the fixture
git remote add origin "$WORK/origin.git"
echo "0.9.9" > VERSION
printf '# log\n\n## Session: 2026-07-05 — seed\n' > SESSION-LOG.md
mkdir -p plans docs/session-notes
git add -A && git commit -qm "chore: seed" && git push -qu origin main
# arm protection AFTER the seed push
mv "$WORK/origin.git/hooks/pre-receive" "$WORK/origin.git/hooks/pre-receive.armed" 2>/dev/null
mv "$WORK/origin.git/hooks/pre-receive.armed" "$WORK/origin.git/hooks/pre-receive"

# Stub gh that records its invocations
mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<EOF
#!/bin/bash
echo "\$@" >> "$WORK/gh-calls.txt"
[ "\$1" = "pr" ] && [ "\$2" = "create" ] && echo "https://example.test/pr/1"
exit 0
EOF
chmod +x "$WORK/bin/gh"

# Dirty file for endsession to sweep
echo "session artifact" > docs/leftover.md

# Run end-session against the fixture
out=$(cd "$REPO" && DW_SESSION_ROOT="$WORK/vault" PATH="$WORK/bin:$PATH" \
  npx tsx scripts/end-session.ts --focus "autoland fixture" --summary "test" 2>&1)
rc=$?

[ $rc -eq 0 ] && ok "end-session exits 0" || err "exit=$rc\n$out"
echo "$out" | grep -q 'STRANDED' && err "still reports STRANDED commits" || ok "no stranded commits"
echo "$out" | grep -q 'landed via PR with auto-merge armed' && ok "auto-landing reported" || err "no auto-landing in output:
$out"

cd "$WORK/vault"
PRB=$(git -C "$WORK/origin.git" for-each-ref --format='%(refname:short)' refs/heads | grep '^docs/session-note-' | head -1)
[ -n "$PRB" ] && ok "PR branch pushed to origin ($PRB)" || err "no session-note branch on origin"
grep -q 'pr create' "$WORK/gh-calls.txt" 2>/dev/null && ok "gh pr create invoked" || err "gh pr create not invoked"
grep -q 'pr merge .* --auto\|--auto' "$WORK/gh-calls.txt" 2>/dev/null && ok "gh pr merge --auto armed" || err "auto-merge not armed"
[ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] && ok "local main reset to origin/main (un-diverged)" || err "main diverged after run"
[ -z "$(git status --short)" ] && ok "working tree clean" || err "tree dirty after run"
[ -n "$PRB" ] && git -C "$WORK/origin.git" show "$PRB:docs/leftover.md" >/dev/null 2>&1 \
  && ok "session commits preserved on the PR branch" || err "session content missing from PR branch"

exit $FAIL
