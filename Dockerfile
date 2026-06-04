# ── API ──────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04 AS node-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg wget \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM node-base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --filter @locci/box-api --ignore-scripts && \
    src=$(find /app/node_modules -path '*/microsandbox*.node' | head -1) && \
    dst=$(find /app/node_modules -path '*/microsandbox/native' -type d | head -1) && \
    { [ -n "$src" ] && [ -n "$dst" ] && cp "$src" "$dst/" || true; }

FROM node-base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY tsconfig.json package.json ./
RUN pnpm build

# JuiceFS client (CE). juicedata/juicefs:latest is a Docker *plugin*; the runnable
# CE client image is juicedata/mount:ce-vX.Y.Z. Its binary is glibc-linked and needs
# libfdb_c.so — both satisfied by the ubuntu:24.04 runner below. Only used for the
# rootless single-container deploy (compose.rootless.yml); harmless otherwise.
FROM juicedata/mount:ce-v1.3.1 AS jfs

FROM node-base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install microsandbox CLI (msb) — needs glibc 2.39, satisfied by ubuntu:24.04
RUN curl -fsSL https://install.microsandbox.dev | sh
# JuiceFS client for optional in-container self-mount (JFS_SELF_MOUNT=true)
COPY --from=jfs /usr/local/bin/juicefs /usr/local/bin/juicefs
COPY --from=jfs /usr/lib/libfdb_c.so /usr/lib/libfdb_c.so
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json docker-entrypoint.sh ./
COPY drizzle ./drizzle
RUN chmod +x docker-entrypoint.sh
EXPOSE 5757
ENTRYPOINT ["./docker-entrypoint.sh"]
