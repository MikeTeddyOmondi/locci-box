# ── Web console (SvelteKit, adapter-node) ────────────────────────────────────
# Dependencies come from the workspace's pnpm-lock.yaml (web/ has no lockfile
# of its own), hoisted so web's packages sit flat in node_modules.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY web/package.json ./web/
# Generous retries: on a slow link a single tarball timed out and failed the build.
RUN pnpm install --frozen-lockfile --filter @locci/box-web --config.node-linker=hoisted \
    --config.fetch-retries=6 --config.fetch-timeout=300000

# Runtime packages only: adapter-node bundles the rest (devDependencies) into
# build/, leaving the two the server imports at runtime (OpenAuth, valibot), both
# pinned. Installed outside the workspace: inside it pnpm also brings the
# workspace root's (the API's) packages, about 100 MB the console never loads.
FROM node:22-alpine AS prod-deps
WORKDIR /deploy
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY web/package.json ./
RUN pnpm install --prod --ignore-workspace --ignore-scripts \
    --config.fetch-retries=6 --config.fetch-timeout=300000

FROM node:22-alpine AS builder
WORKDIR /app/web
COPY --from=deps /app/node_modules /app/node_modules
COPY web/ .
# Node's default heap ran out on some builds (Monaco and Shiki are large).
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npx svelte-kit sync && npx vite build

# Settings are read at runtime (the console reads $env/dynamic), so one image
# serves any deployment: see web/.env.example and the compose file.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4173
COPY --from=builder /app/web/build ./build
COPY --from=prod-deps /deploy/node_modules ./node_modules
COPY web/package.json ./
EXPOSE 4173
CMD ["node", "build"]
