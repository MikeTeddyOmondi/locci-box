# Locci Box

A B2B platform that lets businesses and AI agents run untrusted code safely inside isolated microVMs using the [microsandbox SDK](https://github.com/superradcompany/microsandbox).

## What's Inside

| Package | Description |
|---------|-------------|
| `src/` | Express API — sandbox execution, JWT + API-key auth, multi-tenancy, MCP |
| `web/` | TanStack Start web app — playground, code editor, auth UI |
| `cli/` | `loccibox` CLI — compiled binary, API-key authenticated |
| `.bob_sessions/` | Contains all the IBM Bob chat sessions |

## Features

- **Hardware-isolated execution** — every sandbox runs in its own microVM
- **Sub-100ms boot times** — fast microVM startup via microsandbox
- **Multi-tenant** — isolated sandboxes per organisation with usage limits
- **Dual authentication** — JWT for the web app, API keys for the CLI / API
- **Web playground** — run and test code in the browser
- **MCP integration** — AI agents can call sandbox tools via Model Context Protocol
- **Docker ready** — single `docker compose up` to run API + web

## Supported Languages

- Python
- Node.js (JavaScript / TypeScript)
- Bash
- Ruby

---

## Quick Start

### Prerequisites

- **Node.js 22+** and **pnpm 9+**
- **microsandbox CLI** — required for sandbox execution (KVM-based microVMs):
  ```bash
  curl -fsSL https://install.microsandbox.dev | sh
  msb start          # start the microsandbox daemon
  msb status         # verify it's running
  ```
  > Requires Linux with KVM support (`/dev/kvm`). The daemon must be running before starting the API.

### Development

```bash
# Clone
git clone https://github.com/MikeTeddyOmondi/locci-box.git
cd locci-box

# Install all workspace dependencies
pnpm install

# Copy env and fill in values
cp .env.example .env

# Start API + web together
pnpm dev:all
```

| Service | URL |
|---------|-----|
| API | http://localhost:5757 |
| Web | http://localhost:3000 |

### Docker (recommended for production)

See [docs/DOCKER.md](./docs/DOCKER.md) for full instructions.

```bash
# 1. Install and start microsandbox daemon (on the host)
curl -fsSL https://install.microsandbox.dev | sh && msb start

# 2. Configure and start
cp .env.example .env   # fill in ADMIN_API_KEY and JWT_SECRET
docker compose up -d
```

| Service | URL |
|---------|-----|
| API | http://localhost:5757 |
| Web | http://localhost:4173 |

---

## Authentication

### Web App (JWT)

The web app authenticates via `POST /api/auth/login` or `POST /api/auth/register` and receives a 24-hour JWT stored in `localStorage`. A demo account (`demo@loccibox.dev` / `demo1234`) is seeded automatically.

### CLI / API (API Key)

```bash
Authorization: Bearer YOUR_API_KEY
```

The default dev key is `sk_test_default_key_12345`. Generate production keys via the admin API.

---

## API Reference

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account → returns JWT |
| POST | `/api/auth/login` | Sign in → returns JWT |
| POST | `/api/auth/logout` | Invalidate session |

### Sandbox

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sandbox/run` | JWT or API key | Execute code in microVM |
| GET | `/api/sandbox/:id/status` | JWT or API key | Sandbox status |
| DELETE | `/api/sandbox/:id` | JWT or API key | Stop sandbox |

#### POST /api/sandbox/run

```bash
curl -X POST http://localhost:5757/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"language":"python","code":"print(\"Hello from microVM!\")","timeout":30}'
```

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "status": "completed",
    "stdout": "Hello from microVM!\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 87
  }
}
```

**Parameters:** `language` (`python` | `node` | `bash` | `ruby`), `code` (max 1 MB), `timeout` (seconds, default 30).

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/metrics` | Admin API key | System-wide metrics |
| GET | `/health` | — | Health check |

---

## CLI Tool

```bash
# Run interactively from the monorepo
cd cli && pnpm install && pnpm build
./loccibox --help

# Or via Docker
docker compose --profile cli run --rm cli loccibox run -l python -c "print('hi')"
```

```bash
loccibox init                                     # configure API URL + key
loccibox run -l python -c "print('hello')"        # run code
loccibox run -l node   -f script.js               # run file
loccibox status <sandbox-id>                      # check status
loccibox metrics                                  # view usage
```

See [cli/README.md](./cli/README.md) for full CLI docs.

---

## MCP Server

```bash
pnpm mcp   # or: node dist/mcp/server.js
```

Register with Claude Code:

```bash
claude mcp add --transport stdio locci-box -- node dist/mcp/server.js
```

Available tools: `run_sandbox`, `get_sandbox_status`, `stop_sandbox`.

---

## Environment Variables

```env
# API
PORT=5757
NODE_ENV=development
ADMIN_API_KEY=admin_your_secret_key_here
JWT_SECRET=locci-box-dev-secret-change-in-production
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
DEFAULT_SANDBOX_TIMEOUT_SECONDS=30
DEFAULT_RATE_LIMIT_PER_MINUTE=60
LOG_LEVEL=info

# Web app (browser)
VITE_API_URL=http://localhost:5757

# Docker Compose
WEB_PORT=4173
LOCCIBOX_API_URL=http://api:5757
```

---

## Project Structure

```
locci-box/
├── src/                    # Express API
│   ├── app.ts
│   ├── server.ts
│   ├── routes/
│   │   ├── auth.ts         # JWT auth endpoints
│   │   ├── sandbox.ts
│   │   ├── metrics.ts
│   │   └── health.ts
│   ├── services/
│   │   ├── UserService.ts  # In-memory user store + bcrypt
│   │   ├── SandboxService.ts
│   │   └── TenantService.ts
│   ├── middleware/
│   │   ├── auth.ts         # JWT + API-key dual auth
│   │   ├── rateLimiter.ts
│   │   └── errorHandler.ts
│   ├── mcp/server.ts
│   └── config/env.ts
├── web/                    # TanStack Start web app
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.tsx   # Landing page
│   │   │   ├── login.tsx   # Sign in / register / demo
│   │   │   ├── playground.tsx
│   │   │   └── code.tsx
│   │   ├── lib/auth.tsx    # Auth context + JWT helpers
│   │   └── integrations/api/client.ts
│   └── Dockerfile
├── cli/                    # loccibox CLI
│   ├── src/
│   └── Dockerfile
├── docs/                   # Documentation
│   ├── DOCKER.md
│   ├── QUICKSTART.md
│   └── ...
├── Dockerfile              # API image
├── compose.yaml
├── .env.example
└── pnpm-workspace.yaml
```

---

## Security

- Hardware-isolated microVMs (no shared process risk)
- JWT authentication for web users (24h expiry)
- API key authentication for programmatic access
- Per-tenant rate limiting and concurrent sandbox limits
- Code size limits (1 MB max)
- Execution timeout enforcement
- Structured audit logging (Pino)

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/DOCKER.md](./docs/DOCKER.md) | Docker & Compose guide |
| [docs/QUICKSTART.md](./docs/QUICKSTART.md) | Get started in 3 minutes |
| [docs/SETUP.md](./docs/SETUP.md) | Detailed installation |
| [docs/API_COLLECTION.md](./docs/API_COLLECTION.md) | curl examples for every endpoint |
| [docs/ENV_CONFIGURATION.md](./docs/ENV_CONFIGURATION.md) | Environment variable reference |

---

## License

MIT
