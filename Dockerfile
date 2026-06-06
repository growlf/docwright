# DocWright — development container (Phase 1)
#
# Note: runs Vite dev server. Production mode (adapter-node) is Phase 2.
# Base: node:22-bookworm-slim — NOT alpine (pydantic-core Rust extension
# is ABI-incompatible with musl; bookworm-slim uses glibc).

FROM node:22-bookworm-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        python3 \
        python3-pip \
        python3-venv \
        wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python venv + MCP server deps ─────────────────────────────────────────────
RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir mcp

# ── Node deps for webui (install before copying source for layer caching) ─────
COPY src/webui/package*.json ./src/webui/
RUN cd src/webui && npm ci

# ── Application source ────────────────────────────────────────────────────────
COPY scripts/ ./scripts/
COPY src/    ./src/

# ── Entrypoint ────────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/docwright-entrypoint
RUN chmod +x /usr/local/bin/docwright-entrypoint

# ── Runtime config ────────────────────────────────────────────────────────────
# DOCWRIGHT_ROOT must match the vault volume mount path in docker-compose.yml
ENV DOCWRIGHT_ROOT=/vault \
    DOCWRIGHT_CACHE_DIR=/tmp \
    PORT=5173 \
    MCP_PORT=3002

VOLUME /vault

EXPOSE 5173
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-5173}/api/health | grep -q '"ok":true' || exit 1

ENTRYPOINT ["docwright-entrypoint"]
