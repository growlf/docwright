# DocWright — application image
#
# Builds the SvelteKit web UI as a production server (@sveltejs/adapter-node)
# and bakes it into the image. Default entrypoint runs the built server
# (`node build`); the dogfood dev box overrides with DOCWRIGHT_DEV_SERVER=1 to
# run the Vite dev server over a source mount instead. See docker-entrypoint.sh.
# Base: node:22-bookworm-slim — NOT alpine (pydantic-core Rust extension
# is ABI-incompatible with musl; bookworm-slim uses glibc).

FROM node:22-bookworm-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        wget \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Node deps for webui (install before copying source for layer caching) ─────
COPY src/webui/package*.json ./src/webui/
RUN cd src/webui && npm ci

# ── Node deps for MCP server (root dependencies) ──────────────────────────────
COPY package*.json ./
RUN npm ci

# ── Application source ────────────────────────────────────────────────────────
COPY scripts/ ./scripts/
COPY src/    ./src/
COPY tsconfig.json ./

# ── Build TypeScript components ───────────────────────────────────────────────
RUN npm run compile:mcp

# ── Build the SvelteKit production server (adapter-node) ──────────────────────
# Bakes build/ into the image so nothing is written into the source tree at
# runtime (this is the root fix for the .svelte-kit-in-source-mount bug, #288).
RUN cd src/webui && npm run build

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
