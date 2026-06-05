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

    # Block all direct writes to plan files — full file write belongs in write_plan MCP tool
    if [[ "$REL" == plans/*.md ]]; then
        BLOCK=1
        REASON="Lifecycle gate: direct writes to plan files are not allowed. To rewrite the full file content, use: write_plan(\"${REL#plans/}\", content). This validates lifecycle rules before writing. For targeted edits use: update_step, update_plan_status, append_history, or set_plan_field."
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

    # Block direct edits to plan files — with contextual guidance based on what the edit is doing
    if [[ "$REL" == plans/*.md && "$BLOCK" -eq 0 ]]; then
        PLAN="${REL#plans/}"

        # Category A: status field change → update_plan_status
        if echo "$NEW_STR" | grep -qE "^status: "; then
            NEW_STATUS=$(echo "$NEW_STR" | grep -oE "^status: \S+" | head -1 | awk '{print $2}')
            BLOCK=1
            REASON="Lifecycle gate: to change plan status, use: update_plan_status(\"$PLAN\", \"$NEW_STATUS\"). This validates pending steps and logs the transition before writing."

        # Category B: step marker change → update_step
        elif echo "$NEW_STR" | grep -qE '[⏳✅]'; then
            BLOCK=1
            REASON="Lifecycle gate: to update a step's status marker, use: update_step(\"$PLAN\", \"<step description substring>\", \"done\") or update_step(\"$PLAN\", \"<step>\", \"pending\"). This recounts total_steps/completed_steps automatically."

        # Category C: catch-all — list all mutation tools
        else
            BLOCK=1
            REASON="Lifecycle gate: direct edits to plan files are not allowed. Choose the right MCP tool for your change: update_step (step status) · update_plan_status (status field) · append_history (history row) · set_plan_field (frontmatter field) · write_plan (full rewrite). See docs/SOPs/plan-mutation.md for the full guide."
        fi
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
