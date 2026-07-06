#!/bin/bash
# #143 — Claude Code hook commands must resolve without an interactive-shell
# env var, and must fail LOUD when unresolvable: the PreToolUse lifecycle gate
# blocks (exit 2), advisory hooks error visibly (exit 1). The old commands
# collapsed to /scripts/<hook>.sh and governance silently vanished.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err() { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Fixture "install": stub hook scripts that just announce they ran
mkdir -p "$WORK/scripts"
for h in claude-session-start-hook claude-lifecycle-hook claude-session-boundary-hook claude-tag-push-watch; do
  printf '#!/bin/bash\necho "RAN:%s"\n' "$h" > "$WORK/scripts/$h.sh"
  chmod +x "$WORK/scripts/$h.sh"
done

# Pull the command strings out of settings.json
mapfile -t COMMANDS < <(node -e '
  const s = require(process.argv[1]);
  for (const evt of Object.values(s.hooks)) for (const m of evt) for (const h of m.hooks) console.log(h.command);
' "$REPO/.claude/settings.json")
[ "${#COMMANDS[@]}" -eq 4 ] || err "expected 4 hook commands in settings.json, got ${#COMMANDS[@]}"

lifecycle_cmd=""
for c in "${COMMANDS[@]}"; do
  echo "$c" | grep -q 'claude-lifecycle-hook' && lifecycle_cmd="$c"
done
[ -n "$lifecycle_cmd" ] || err "no lifecycle-hook command found"

# 1. CLAUDE_PROJECT_DIR fallback works with DOCWRIGHT_PATH unset (the #143 scenario)
for c in "${COMMANDS[@]}"; do
  out=$(env -u DOCWRIGHT_PATH CLAUDE_PROJECT_DIR="$WORK" sh -c "$c" 2>&1)
  echo "$out" | grep -q '^RAN:' || err "command did not resolve via CLAUDE_PROJECT_DIR: $out"
done
[ "$FAIL" -eq 0 ] && ok "all 4 hooks resolve via CLAUDE_PROJECT_DIR (no DOCWRIGHT_PATH)"

# 2. DOCWRIGHT_PATH takes precedence when set
out=$(DOCWRIGHT_PATH="$WORK" CLAUDE_PROJECT_DIR="/nonexistent" sh -c "$lifecycle_cmd" 2>&1)
echo "$out" | grep -q '^RAN:claude-lifecycle-hook' && ok "DOCWRIGHT_PATH takes precedence" \
  || err "DOCWRIGHT_PATH precedence broken: $out"

# 3. Unresolvable: lifecycle gate BLOCKS (exit 2, loud); advisory hooks exit 1
env -u DOCWRIGHT_PATH CLAUDE_PROJECT_DIR="$WORK/empty" sh -c "$lifecycle_cmd" >/dev/null 2>"$WORK/err.txt"
rc=$?
[ "$rc" -eq 2 ] && ok "unresolvable lifecycle gate blocks (exit 2)" \
  || err "unresolvable lifecycle gate exit=$rc (want 2 — fail-safe means BLOCK)"
grep -q 'UNRESOLVABLE' "$WORK/err.txt" && ok "block reason is loud" || err "no loud reason on stderr"

for c in "${COMMANDS[@]}"; do
  [ "$c" = "$lifecycle_cmd" ] && continue
  env -u DOCWRIGHT_PATH CLAUDE_PROJECT_DIR="$WORK/empty" sh -c "$c" >/dev/null 2>&1
  rc=$?
  [ "$rc" -eq 1 ] || err "advisory hook unresolvable exit=$rc (want 1 — loud, non-blocking)"
done
[ "$FAIL" -eq 0 ] && ok "advisory hooks fail loud without blocking"

exit $FAIL
