# ── Web (TanStack Start) ─────────────────────────────────────────────────────
# Dependencies come from the workspace's pnpm-lock.yaml. web/ has no lockfile of
# its own, and a bare `bun install` took the newest version in every ^ range:
# with @lovable.dev/vite-tanstack-config 1.8.0 the build skipped TanStack Start
# and vite looked for an index.html. Hoisted, so web's packages sit flat in node_modules.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json ./web/
# Generous retries: on a slow link a single tarball timed out and failed the build.
RUN pnpm install --frozen-lockfile --filter @locci/box-web --config.node-linker=hoisted \
    --config.fetch-retries=6 --config.fetch-timeout=300000 --config.network-concurrency=8

FROM oven/bun:1-alpine AS builder
WORKDIR /app/web
COPY --from=deps /app/node_modules /app/node_modules
COPY web/ .
# Inject build-time env — override at runtime via docker run -e or compose.
# NOTE: only VITE_-prefixed vars are bundled into the client. The admin fallback
# credential is read server-side at runtime from process.env.ADMIN_API_KEY (see
# the SSR branch of integrations/api/client.ts), so it is NOT baked in here.
ARG VITE_API_URL=http://api:5757
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache nginx
COPY --from=builder /app/web/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY web/package.json ./
COPY web/nginx.conf /etc/nginx/http.d/default.conf
COPY web/web-entrypoint.sh ./web-entrypoint.sh
RUN chmod +x web-entrypoint.sh
EXPOSE 4173
CMD ["./web-entrypoint.sh"]
