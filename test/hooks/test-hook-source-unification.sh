#!/bin/bash
# Drift guard (#144): .githooks/* must be thin exec-shims pointing at the
# canonical scripts/*.sh sources — never copies that can drift. This is the
# structural fix for the divergence found 2026-07-06 (.githooks/pre-commit
# was 10+ changes behind scripts/pre-commit.sh).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
err()  { echo -e "${RED}[✗]${NC} $1"; FAIL=1; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }

for hook in pre-commit commit-msg; do
  shim="$ROOT/.githooks/$hook"
  src="$ROOT/scripts/$hook.sh"

  [ -f "$src" ] || { err "canonical source missing: scripts/$hook.sh"; continue; }
  [ -x "$src" ] || err "canonical source not executable: scripts/$hook.sh"
  [ -f "$shim" ] || { err "shim missing: .githooks/$hook"; continue; }
  [ -x "$shim" ] || err "shim not executable: .githooks/$hook"

  # The shim must exec the canonical source and stay thin — logic added here
  # instead of the canonical source is exactly the drift #144 killed.
  grep -qE '^exec .*scripts/'"$hook"'\.sh' "$shim" \
    || err ".githooks/$hook does not exec scripts/$hook.sh — hook logic is drifting again"
  lines=$(grep -cv '^\s*#\|^\s*$' "$shim")
  [ "$lines" -le 3 ] \
    || err ".githooks/$hook has $lines non-comment lines (max 3) — move logic to scripts/$hook.sh"
  [ "$FAIL" -eq 0 ] && ok "$hook: shim → scripts/$hook.sh, thin, executable"
done

# The installer must reference both hooks (vaults get commit-msg too, #144)
grep -q 'commit-msg' "$ROOT/scripts/install-hooks.sh" \
  && ok "install-hooks.sh installs commit-msg" \
  || err "install-hooks.sh does not install commit-msg"

exit $FAIL
