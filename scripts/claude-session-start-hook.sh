#!/usr/bin/env bash
# claude-session-start-hook.sh — SessionStart hook for Claude Code
#
# Fires at the start of every session, regardless of the user's first
# message — unlike the docwright-session-start skill, which only runs when
# the AI chooses to invoke it. Surfaces open GitHub issues labeled "urgent"
# as injected context so they cannot be silently skipped by starting a
# session with an unrelated request.
#
# Stdin: JSON { session_id, ... } (unused)
# Stdout: JSON { systemMessage, hookSpecificOutput: { additionalContext } }
# Exit 0 always — never blocks session start, even if gh is unavailable
# or the network is down.

set -uo pipefail

cd "${DOCWRIGHT_PATH:-$(dirname "$0")/..}" 2>/dev/null || exit 0

command -v gh &>/dev/null || exit 0
command -v jq &>/dev/null || exit 0

ISSUES=$(timeout 8 gh issue list --label urgent --state open --json number,title,url 2>/dev/null) || exit 0
[[ -z "$ISSUES" || "$ISSUES" == "[]" ]] && exit 0

COUNT=$(jq 'length' <<< "$ISSUES")
LINES=$(jq -r '.[] | "- #\(.number) \(.title) — \(.url)"' <<< "$ISSUES")

CONTEXT="URGENT — resolve before resuming feature work ($COUNT open issue(s) labeled 'urgent'):
$LINES

Per this repo's bugs-before-features / code-over-memory philosophy, these must be
addressed (or explicitly deferred with a logged decision) before starting unrelated
feature work this session."

jq -n --arg ctx "$CONTEXT" --arg msg "⚠ $COUNT urgent GitHub issue(s) open" '{
  systemMessage: $msg,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'
