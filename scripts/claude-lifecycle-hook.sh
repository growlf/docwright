#!/usr/bin/env bash
# claude-lifecycle-hook.sh — PreToolUse gate for Claude Code
#
# Blocks lifecycle mutations that require human authorization:
#   - Writing approved: true to proposals/approved/ without HUMAN_APPROVED=1
#   - Editing a file to flip approved: false → approved: true
#   - Any direct Write/Edit to plans/*.md (use MCP tools instead)
#
# Stdin: JSON { tool_name, tool_input: { file_path, content|old_string|new_string } }
# Exit 0  → allow the write
# Exit 1  → block (with JSON stop reason)

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT=$(cat)

py() { python3 -c "$1" 2>/dev/null || echo ""; }

TOOL_NAME=$(py "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" <<< "$INPUT")
FILE_PATH=$(py "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" <<< "$INPUT")

[ -z "$FILE_PATH" ] && exit 0

# Normalise to repo-relative path
REL="${FILE_PATH#$ROOT/}"
[[ "$REL" == /* ]] && exit 0   # outside this repo — skip

# Only intercept lifecycle directories
case "$REL" in
    proposals/*|plans/*|docs/*) ;;
    *) exit 0 ;;
esac

BLOCK=0
REASON=""

if [[ "$TOOL_NAME" == "Write" ]]; then
    CONTENT=$(py "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('content',''))" <<< "$INPUT")

    # Block writing approved: true into proposals/approved/ without human auth
    if [[ "$REL" == proposals/approved/* ]] && echo "$CONTENT" | grep -q "^approved: true"; then
        OLD=$(git -C "$ROOT" show "HEAD:$REL" 2>/dev/null \
              | awk '/^approved:/{print $2; exit}' \
              || echo "new")
        if [[ "$OLD" != "true" && -z "${HUMAN_APPROVED:-}" ]]; then
            BLOCK=1
            REASON="Lifecycle gate: writing 'approved: true' to $REL requires human authorization. Run with HUMAN_APPROVED=1 if you have explicit human approval."
        fi
    fi

    # Block all direct writes to plan files — use MCP tools instead
    if [[ "$REL" == plans/*.md ]]; then
        BLOCK=1
        REASON="Lifecycle gate: direct writes to plan files are not allowed. Use MCP tools: update_step, update_plan_status, append_history, set_plan_field, or write_plan for structural rewrites."
    fi

elif [[ "$TOOL_NAME" == "Edit" ]]; then
    OLD_STR=$(py "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('old_string',''))" <<< "$INPUT")
    NEW_STR=$(py "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('new_string',''))" <<< "$INPUT")

    # Block any edit that flips approved: false → approved: true in any lifecycle file
    if echo "$NEW_STR" | grep -q "approved: true" && echo "$OLD_STR" | grep -q "approved: false"; then
        if [[ -z "${HUMAN_APPROVED:-}" ]]; then
            BLOCK=1
            REASON="Lifecycle gate: edit flips 'approved: false' → 'approved: true' in $REL. Only humans may approve proposals. Run with HUMAN_APPROVED=1 if authorized."
        fi
    fi

    # Block all direct edits to plan files — use MCP tools instead
    if [[ "$REL" == plans/*.md ]]; then
        BLOCK=1
        REASON="Lifecycle gate: direct edits to plan files are not allowed. Use MCP tools: update_step, update_plan_status, append_history, set_plan_field, or write_plan for structural rewrites."
    fi
fi

if [[ "$BLOCK" -eq 1 ]]; then
    python3 -c "
import json, sys
print(json.dumps({'continue': False, 'stopReason': sys.argv[1]}))
" "$REASON"
    exit 1
fi

exit 0
