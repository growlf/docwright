#!/bin/bash
# harden-plan-proposal-lifecycle-tooling step 3.2 — the PreToolUse lifecycle gate
# must DENY direct Write/Edit to plans/*.md (and un-authorized approvals) with the
# Claude Code blocking signal (exit 2 + reason on stderr). Previously it emitted a
# non-blocking exit 1, so the harness performed the write anyway.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO/scripts/claude-lifecycle-hook.sh"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

run() { # $1 = JSON payload → sets RC + ERR
  printf '%s' "$1" | bash "$HOOK" >/dev/null 2>"$WORK/err"; RC=$?
  ERR=$(cat "$WORK/err")
}

# 1. Direct Edit to a plan (status change) must DENY (exit 2) and point at update_plan_status.
run "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$REPO/plans/x.md\",\"old_string\":\"status: draft\",\"new_string\":\"status: approved\"}}"
{ [ "$RC" -eq 2 ] && echo "$ERR" | grep -q "update_plan_status"; } \
  && ok "Edit plan status → exit 2 + update_plan_status guidance" \
  || err "Edit plan status not blocked correctly (RC=$RC): $ERR"

# 2. Direct Write to a plan must DENY (exit 2) and point at write_plan.
run "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$REPO/plans/x.md\",\"content\":\"---\\nstatus: draft\\n---\\n\"}}"
{ [ "$RC" -eq 2 ] && echo "$ERR" | grep -q "write_plan"; } \
  && ok "Write plan → exit 2 + write_plan guidance" \
  || err "Write plan not blocked correctly (RC=$RC): $ERR"

# 3. Edit to a NON-lifecycle file must be allowed (exit 0).
run "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$REPO/src/dispatch/frontmatter.ts\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
[ "$RC" -eq 0 ] && ok "Edit to a source file → allowed (exit 0)" || err "non-lifecycle edit wrongly blocked (RC=$RC): $ERR"

# 4. Edit flipping approved false→true without HUMAN_APPROVED must DENY (exit 2).
run "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$REPO/proposals/foo.md\",\"old_string\":\"approved: false\",\"new_string\":\"approved: true\"}}"
[ "$RC" -eq 2 ] && ok "approved false→true without seal → exit 2" || err "approval flip not blocked (RC=$RC): $ERR"

[ $FAIL -eq 0 ] && echo -e "${GREEN}test-pretooluse-plan-edit-block: PASS${NC}" || echo -e "${RED}test-pretooluse-plan-edit-block: FAIL${NC}"
exit $FAIL
