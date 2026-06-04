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
# VITE_API_KEY is the fallback credential bundled into the client (used for SSR and
# when no user JWT is present). WARNING: it ends up in the public JS bundle.
ARG VITE_API_KEY=
ENV VITE_API_KEY=$VITE_API_KEY
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache nginx
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY web/nginx.conf /etc/nginx/http.d/default.conf
COPY web/web-entrypoint.sh ./web-entrypoint.sh
RUN chmod +x web-entrypoint.sh
EXPOSE 4173
CMD ["./web-entrypoint.sh"]
