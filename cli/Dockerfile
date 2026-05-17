# ── CLI (standalone binary via bun build --compile) ──────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY cli/package.json ./
COPY cli/src ./src/
RUN bun install --frozen-lockfile
RUN bun build --compile --outfile=loccibox ./src/index.ts

# Minimal final image — just the binary
FROM debian:bookworm-slim
COPY --from=builder /app/loccibox /usr/local/bin/loccibox
RUN chmod +x /usr/local/bin/loccibox
ENTRYPOINT ["loccibox"]
