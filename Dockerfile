# ── API ──────────────────────────────────────────────────────────────────────
# Run `pnpm build` locally before building this image.
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --filter @locci-box/api

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY dist/ ./dist/
# Remove static microsandbox import — native addon requires KVM unavailable in Docker
RUN sed -i 's|import { Sandbox } from "microsandbox";||' dist/services/SandboxService.js
COPY package.json ./
EXPOSE 5757
CMD ["node", "dist/server.js"]
