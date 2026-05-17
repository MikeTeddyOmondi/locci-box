# ── Web (TanStack Start) ─────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
# Inject build-time env — override at runtime via docker run -e or compose
ARG VITE_API_URL=http://api:5757
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 4173
CMD ["bun", "run", "preview", "--host", "0.0.0.0", "--port", "4173"]
