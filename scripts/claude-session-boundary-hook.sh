#!/usr/bin/env bash
# claude-session-boundary-hook.sh — PostToolUse session-boundary notifier
#
# Fires after Write/Edit tool calls. If AGENTS.md or CLAUDE.md was just
# modified, surfaces a reminder that the change takes effect next session.
#
# Stdin: JSON { tool_name, tool_input: { file_path, ... }, tool_response }
# Stdout: message string (shown to Claude as hook feedback)
# Exit 0 always (informational only — never blocks)

set -uo pipefail

INPUT=$(cat)

node_eval() { node -e "const input = JSON.parse(require('fs').readFileSync(0, 'utf8')); $1" <<< "$INPUT" 2>/dev/null || echo ""; }

FILE_PATH=$(node_eval "console.log(input.tool_input?.file_path || '')")
[ -z "$FILE_PATH" ] && exit 0

BASENAME=$(basename "$FILE_PATH")

case "$BASENAME" in
    AGENTS.md|CLAUDE.md)
        echo "SESSION BOUNDARY: $BASENAME was just modified. The updated instructions will be loaded at the START of the NEXT Claude Code session — they are NOT active in this session. If the change is governance-critical (e.g. a new invariant or prohibited action), restart the session now before continuing. See docs/ai-governance-enforcement.md §Session-boundary model."
        ;;
esac

exit 0
