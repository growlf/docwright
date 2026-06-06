#!/bin/sh
set -e

# ── Git identity ──────────────────────────────────────────────────────────────
git config --global user.name  "${GIT_USER_NAME:-DocWright User}"
git config --global user.email "${GIT_USER_EMAIL:-docwright@localhost}"

# ── Git credentials (HTTPS) ───────────────────────────────────────────────────
# For SSH key auth: mount your key at /root/.ssh/id_ed25519 instead.
if [ -n "${GIT_TOKEN}" ]; then
    git config --global credential.helper store
    printf 'https://%s:%s@github.com\n' "${GIT_USER_NAME:-user}" "${GIT_TOKEN}" \
        >> /root/.git-credentials
fi

# ── MCP server (SSE mode, background) ────────────────────────────────────────
DOCWRIGHT_ROOT="${DOCWRIGHT_ROOT:-/vault}" \
DOCWRIGHT_CACHE_DIR="${DOCWRIGHT_CACHE_DIR:-/tmp}" \
MCP_HOST=0.0.0.0 \
MCP_PORT="${MCP_PORT:-3002}" \
    /app/.venv/bin/python3 /app/scripts/mcp-server.py --serve &

MCP_PID=$!
trap 'kill "$MCP_PID" 2>/dev/null; exit' INT TERM EXIT

# ── Web UI (Vite dev server) ──────────────────────────────────────────────────
cd /app/src/webui
exec npm run dev -- --host 0.0.0.0 --port "${PORT:-5173}"
