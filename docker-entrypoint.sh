#!/bin/sh
set -e

# ── Git identity + safe directory ────────────────────────────────────────────
git config --global user.name  "${GIT_USER_NAME:-DocWright User}"
git config --global user.email "${GIT_USER_EMAIL:-docwright@localhost}"
git config --global --add safe.directory "${DOCWRIGHT_ROOT:-/vault}"

# ── Git credentials (HTTPS) ───────────────────────────────────────────────────
# For SSH key auth: mount your key at /root/.ssh/id_ed25519 instead.
if [ -n "${GIT_TOKEN}" ]; then
    git config --global credential.helper store
    printf 'https://%s:%s@github.com\n' "${GIT_USER_NAME:-user}" "${GIT_TOKEN}" \
        >> /root/.git-credentials
fi

# ── MCP server (Python, port 3002, background) ────────────────────────────────
DOCWRIGHT_ROOT="${DOCWRIGHT_ROOT:-/vault}" \
DOCWRIGHT_CACHE_DIR="${DOCWRIGHT_CACHE_DIR:-/tmp}" \
MCP_HOST=0.0.0.0 \
MCP_PORT=3002 \
    /app/.venv/bin/python3 /app/scripts/mcp-server.py --serve &
PY_MCP_PID=$!

# ── MCP server (TypeScript, port 3100, background) ─────────────────────────────
DOCWRIGHT_VAULT_ROOT="${DOCWRIGHT_ROOT:-/vault}" \
DOCWRIGHT_CACHE_DIR="${DOCWRIGHT_CACHE_DIR:-/tmp}" \
DOCWRIGHT_MCP_PORT=3100 \
    node /app/dist/mcp/server.js --mode vault --transport sse &
TS_MCP_PID=$!

trap 'kill "$PY_MCP_PID" "$TS_MCP_PID" 2>/dev/null; exit' INT TERM EXIT

# ── Web UI (Vite dev server) ──────────────────────────────────────────────────
cd /app/src/webui
exec npm run dev -- --host 0.0.0.0 --port "${PORT:-5173}"
