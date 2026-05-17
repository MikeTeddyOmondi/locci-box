# Docker Guide

Locci Box ships three Docker images and a `compose.yaml` that wires them together.

| Image | Dockerfile | Description |
|-------|-----------|-------------|
| `locci/box-api` | `Dockerfile` | Express API (Node 22 Debian slim) |
| `locci/box-web` | `web/Dockerfile` | TanStack Start preview (Bun Alpine) |
| `locci/box-cli` | `cli/Dockerfile` | `loccibox` standalone binary (Debian slim) |

---

## Prerequisites

- Docker 24+ with Compose V2 (`docker compose`)
- 2 GB RAM minimum (4 GB recommended for microVM execution)
- Linux with KVM enabled for production sandbox execution

---

## Quick Start

```bash
# 1. Copy env and set required secrets
cp .env.example .env
#    edit .env → set ADMIN_API_KEY and JWT_SECRET

# 2. Start API + web
docker compose up -d

# 3. Check health
curl http://localhost:5757/health
```

Services:

| Service | URL | Notes |
|---------|-----|-------|
| API | http://localhost:5757 | REST + MCP |
| Web | http://localhost:4173 | Vite preview server |

---

## Environment Variables

All variables have defaults. The only ones you **must** set for production:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_API_KEY` | Yes | — | Admin key for `/api/metrics` |
| `JWT_SECRET` | Yes | dev fallback | Signing secret for web-app JWTs |
| `PORT` | No | `5757` | API listen port |
| `WEB_PORT` | No | `4173` | Web preview port |
| `NODE_ENV` | No | `production` | `production` \| `development` |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `DEFAULT_MAX_CONCURRENT_SANDBOXES` | No | `5` | Per-tenant sandbox limit |
| `DEFAULT_SANDBOX_TIMEOUT_SECONDS` | No | `30` | Max execution time |
| `DEFAULT_RATE_LIMIT_PER_MINUTE` | No | `60` | Per-tenant request rate |
| `VITE_API_URL` | No | `http://localhost:5757` | Browser → API URL (build-time arg) |

Generate secure values:

```bash
openssl rand -base64 18   # ADMIN_API_KEY
openssl rand -base64 32   # JWT_SECRET
```

---

## Building Images

### All at once

```bash
pnpm docker:build
# or
docker compose build
```

### Individually

```bash
# API
docker build -t locci/box-api -f Dockerfile .

# Web (pass the public API URL at build time)
docker build -t locci/box-web \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  -f web/Dockerfile .

# CLI
docker build -t locci/box-cli -f cli/Dockerfile .
```

> `VITE_API_URL` is a **build-time** arg baked into the browser bundle. If you need to change the API URL after building, rebuild the web image.

---

## Running with Compose

```bash
# Start (detached)
docker compose up -d

# Tail logs
docker compose logs -f

# Stop
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Port overrides

```bash
PORT=8080 WEB_PORT=3000 docker compose up -d
```

---

## CLI Profile

The CLI image is gated behind the `cli` profile so it doesn't start by default.

```bash
# One-shot command
docker compose --profile cli run --rm cli loccibox run -l python -c "print('hello')"

# Interactive shell (override entrypoint)
docker compose --profile cli run --rm --entrypoint sh cli

# Init wizard
docker compose --profile cli run --rm cli loccibox init
```

Environment variables the CLI container reads:

| Variable | Default | Description |
|----------|---------|-------------|
| `LOCCIBOX_API_URL` | `http://api:5757` | API base URL (uses service name inside Docker) |
| `LOCCIBOX_API_KEY` | value of `ADMIN_API_KEY` | Auth key |

---

## Healthcheck

The API container has a built-in healthcheck. The web service won't start until the API is healthy:

```yaml
depends_on:
  api:
    condition: service_healthy
```

Check status manually:

```bash
docker inspect locci-box-api --format='{{.State.Health.Status}}'
```

---

## Production Notes

1. **KVM** — microsandbox needs KVM for hardware isolation. Pass the device through:
   ```yaml
   devices:
     - /dev/kvm:/dev/kvm
   ```
   Add this under the `api` service in a `compose.override.yaml`.

2. **Reverse proxy** — put Nginx or Caddy in front and terminate TLS there. Set `VITE_API_URL` to your public API domain at image build time.

3. **Persistent storage** — the current implementation uses in-memory state. For production, mount a volume or switch to PostgreSQL + Redis.

4. **Secrets** — use Docker secrets or an env manager (Doppler, Vault) instead of a plain `.env` file.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Web shows CORS error | Ensure `VITE_API_URL` matches the actual API origin the browser uses |
| `service "web" is not healthy` | API didn't pass healthcheck — check `docker compose logs api` |
| CLI can't reach API | Use `http://api:5757` (Docker service name), not `localhost` |
| `bun install --frozen-lockfile` fails | Run `bun install` locally inside `web/` or `cli/` to regenerate lockfile |
