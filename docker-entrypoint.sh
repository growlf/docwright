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

# ── MCP server (TypeScript, background) ────────────────────────────────────────
DOCWRIGHT_VAULT_ROOT="${DOCWRIGHT_ROOT:-/vault}" \
DOCWRIGHT_CACHE_DIR="${DOCWRIGHT_CACHE_DIR:-/tmp}" \
DOCWRIGHT_MCP_PORT="${MCP_PORT:-3002}" \
    node /app/dist/mcp/server.js --mode vault --transport sse &
MCP_PID=$!

trap 'kill "$MCP_PID" 2>/dev/null; exit' INT TERM EXIT

# ── Web UI ────────────────────────────────────────────────────────────────────
cd /app/src/webui
if [ "${DOCWRIGHT_DEV_SERVER}" = "1" ]; then
    # Dev mode (dogfood box only): Vite dev server over a source mount.
    # Requires the source bind-mounted at /app; writes .svelte-kit at runtime.
    exec npm run dev -- --host 0.0.0.0 --port "${PORT:-5173}"
else
    # Production (default): run the adapter-node build baked into the image.
    # adapter-node reads HOST/PORT/ORIGIN from the environment.
    export HOST="${HOST:-0.0.0.0}"
    export PORT="${PORT:-5173}"
    exec node build
fi
