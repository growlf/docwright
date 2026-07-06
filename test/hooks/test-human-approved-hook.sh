#!/usr/bin/env bash
# test/hooks/test-human-approved-hook.sh
# End-to-end test of the HUMAN-APPROVED approval gate, which spans TWO hooks:
#   pre-commit  — detects a proposal's `approved` flipping false→true, arms a flag
#   commit-msg  — requires HUMAN-APPROVED:<name> in the REAL commit message
#
# Regression test for the stale-COMMIT_EDITMSG bug:
#   proposals/bug-human-approved-precommit-check-broken.md
# The old gate greped .git/COMMIT_EDITMSG inside pre-commit, which at that stage
# holds the PREVIOUS commit's message — so it blocked valid approvals (false
# negative) and would pass markerless approvals when the prior commit happened to
# carry the marker (false positive). This test asserts both are now correct.
#
# Run: bash test/hooks/test-human-approved-hook.sh

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# pre-commit validates proposal frontmatter via `require('js-yaml')`; make it
# resolvable from the throwaway repo created below.
export NODE_PATH="$REPO/node_modules"

passed=0; failed=0

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

git init -q
git config user.name "Hook Test"
git config user.email "hooktest@example.com"
git config commit.gpgsign false
git config core.hooksPath .git/hooks   # override any inherited global hooksPath
mkdir -p .git/hooks proposals/approved
# Copy the CANONICAL sources (#144) — .githooks/ holds thin shims whose exec
# target does not exist inside this throwaway repo.
cp "$REPO/scripts/pre-commit.sh" .git/hooks/pre-commit
cp "$REPO/scripts/commit-msg.sh" .git/hooks/commit-msg
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg

write_prop() {  # $1 = approved value (true|false)
    cat > proposals/p.md <<EOF
---
title: Test Proposal
author: NetYeti
author-role: contributor
created: 2026-06-30
tags:
  - test
approved: $1
created_by: "NetYeti@test"
assigned_to: ""
---
Body.
EOF
}

# Commit using a full message read from stdin (so the marker can sit on its own
# line, mirroring \`git commit -m "subj" -m "HUMAN-APPROVED:Name"\`).
attempt_commit() {  # $1 = full commit message
    git commit -q -F - <<<"$1" >/dev/null 2>&1
}

assert_pass() {  # $1 = label
    if [ "$?" -eq 0 ]; then echo "  ✅ $1"; ((passed++)); else echo "  ❌ $1  (expected commit to SUCCEED)"; ((failed++)); fi
}
assert_fail() {  # $1 = label
    if [ "$?" -ne 0 ]; then echo "  ✅ $1"; ((passed++)); else echo "  ❌ $1  (expected commit to be BLOCKED)"; ((failed++)); fi
}

echo ""
echo "HUMAN-APPROVED approval gate (pre-commit arms → commit-msg asserts):"

# ── Baseline: an unapproved proposal in history ───────────────────────────────
write_prop false
git add proposals/p.md
attempt_commit "docs: add test proposal"
assert_pass "baseline: add unapproved proposal"

# ── Case 1: approve WITHOUT marker → BLOCKED (was a false NEGATIVE under the bug)
write_prop true
git add proposals/p.md
attempt_commit "docs: approve proposal"
assert_fail "approve false→true without marker is blocked"

# ── Case 2: approve WITH marker → ALLOWED (the bug wrongly blocked this) ───────
# (staged approval from Case 1 persists; just supply the marker this time)
attempt_commit $'docs: approve proposal\n\nHUMAN-APPROVED:NetYeti'
assert_pass "approve false→true with marker is allowed"

# ── Case 3: a non-approval edit needs no marker ───────────────────────────────
printf '\nMore body.\n' >> proposals/p.md   # approved stays true → no false→true flip
git add proposals/p.md
attempt_commit "docs: edit proposal body"
assert_pass "non-approval edit needs no marker"

# ── Case 4 (regression): prior commit carried the marker, current does NOT ─────
# Reset approval to false (true→false is not a flip we gate), carrying a marker in
# THIS message only to seed COMMIT_EDITMSG with it.
write_prop false
git add proposals/p.md
attempt_commit $'docs: unapprove proposal\n\nHUMAN-APPROVED:Ghost'
assert_pass "un-approval (true→false) needs no gating"
# Now approve again with a markerless message. The OLD code would read the stale
# COMMIT_EDITMSG (which still says HUMAN-APPROVED:Ghost) and WRONGLY allow it.
write_prop true
git add proposals/p.md
attempt_commit "docs: sneak approval past stale message"
assert_fail "stale prior-commit marker does NOT satisfy the gate (false-positive guard)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "$((passed + failed)) tests: $passed passed, $failed failed"
[ $failed -gt 0 ] && exit 1
exit 0
