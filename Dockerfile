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

FROM node-base AS runner
WORKDIR /app
ENV NODE_ENV=production
# The microsandbox runtime (msb, libkrunfw) comes with the SDK's platform package
# in node_modules, so it always matches the SDK; docker-entrypoint.sh points
# MSB_PATH at it. (An unpinned install.microsandbox.dev runtime once ran ahead of
# the SDK and migrated its database to a schema the SDK could not read.)
# JuiceFS CE client for optional in-container self-mount (JFS_SELF_MOUNT=true).
# Use the official CE binary (self-contained for S3) — NOT the juicedata/mount
# image binary, which is dynamically linked to librados/libfdb (Ceph/FDB) and
# fails with "librados.so.2: cannot open shared object file" on a minimal image.
RUN curl -fsSL https://d.juicefs.com/install | sh
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json docker-entrypoint.sh ./
COPY drizzle ./drizzle
RUN chmod +x docker-entrypoint.sh
EXPOSE 5757
ENTRYPOINT ["./docker-entrypoint.sh"]
