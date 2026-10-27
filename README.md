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

| `language` | Runtime (image) | Runs |
|---|---|---|
| `python` | Python 3.15 (`python:3.15-slim`) | `python3 main.py` |
| `node` | Node.js 26 (`node:26-alpine`) | `node main.js` |
| `bash` | Bash 5.3 (`bash:5.3`) | `bash main.sh` |
| `ruby` | Ruby 4.0 (`ruby:4.0-alpine`) | `ruby main.rb` |
| `go` | Go 1.27 (`golang:1.27-alpine`) | `go run main.go` |
| `rust` | Rust 1.99 (`rust:1.99-alpine`) | `rustc main.rs && ./main` |
| `c` | GCC 16.2 (`gcc:16.2`) | `gcc main.c -lm && ./main` |
| `cpp` | GCC 16.2, C++23 (`gcc:16.2`) | `g++ -std=c++23 main.cpp && ./main` |

The code is written to a file in the sandbox's scratch folder and run from there, so Go, Rust, C and C++ take a whole program (`package main` and `func main`, `fn main`, `int main`). Each image is the latest stable release pinned to its minor version. Compilers get at least 512 MB (Go, Rust) or 256 MB (C, C++). Compiling has its own 120 s limit; `timeout` limits the program's run (a run past it answers `status: "timeout"`, exit code 124), and a compile error comes back as the compiler's output and exit code. Go builds its standard library into its cache on first use (4.6 s per run on an M-series Mac, 280 s on a busy 2-core host), so the API builds it once per Go version into `RUNTIME_CACHE_ROOT` (181 MB) and each run links it read-only into its own cache: a Go program using `encoding/json` and `net/http` then builds and runs in 1.2 s. Measured on an M-series Mac with the images cached: Python, Node, Bash, Ruby and C in 0.3 to 0.5 s, Rust 0.7 s, C++ 1.1 s, Go 1.2 s. The API pulls missing runtime images at startup (gcc is about 1.4 GB) and answers `503` for a language whose image is still downloading. Each run's microVM is deleted when it ends.

---

## Quick Start

### Prerequisites

- **Node.js 22+** and **pnpm 9+**
- **microsandbox** (KVM-based microVMs) comes with the SDK: `pnpm install` brings `microsandbox` 0.7.8 and its platform package, which carries the runtime (`msb`, `libkrunfw`). Linux needs KVM (`/dev/kvm`); macOS runs it on Apple silicon.
  > A runtime in `~/.microsandbox` takes precedence over the bundled one. If it is another version (an older `install.microsandbox.dev` install), set `MSB_PATH` and `MSB_LIBKRUNFW_PATH` to the bundled files, or `MSB_HOME` to a separate (short) folder: a runtime of another version migrates or cannot read the other's database. The Docker image does this in `docker-entrypoint.sh`.

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
# 1. Configure and start (the microsandbox runtime ships in the image, matching the SDK)
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

**Parameters:** `language` (`python` | `node` | `bash` | `ruby` | `go` | `rust` | `c` | `cpp`), `code` (max 1 MB), `timeout` (seconds, default 30).

### Agent boxes

A box is a microVM an AI works in across calls, the way a person works in a VM: a Debian image
with apt, git, curl, gcc and make, plus the toolchain of the `language` asked for. Each language
has its own official image rather than one image with every toolchain:

| `language` | Image |
|---|---|
| `node` (default), `bash` | `BOX_IMAGE`, `docker.io/library/node:26` |
| `python` | `docker.io/library/python:3.15` |
| `go` | `docker.io/library/golang:1.27` |
| `rust` | `docker.io/library/rust:1.99` |
| `ruby` | `docker.io/library/ruby:4.0` |
| `c`, `cpp` | `docker.io/library/gcc:16.2` |

All but gcc are built on `buildpack-deps:trixie`, so microsandbox stores that base once and each
extra language costs only its toolchain. A box has
1 GB of memory and 2 vCPUs by default, work in `/workspace`. It keeps running between calls,
stops after 15 minutes without one (or 8 hours after it started), and starts again under the
same id on the next call with its disk as it was: files, apt and npm installs. Egress is open to
the public internet; private, CGNAT, loopback, link-local (cloud metadata included) and
multicast ranges, the host itself and their IPv6 equivalents are refused. A running box counts
against the tenant's sandbox limit like a `run_sandbox` run. Boxes belong to the user behind the
key or token (all user keys share `tenant_default`), or to the tenant for a tenant key; another
owner's box id answers `404`.

| Method | Path | Body / query | Description |
|--------|------|--------------|-------------|
| POST | `/api/boxes` | `{language?, box_id?}` | Create a box (`201`), or reattach to one, starting it if stopped (`200`; it keeps its image) |
| GET | `/api/boxes` | | Your boxes, running and stopped |
| GET | `/api/boxes/:id` | | One box |
| POST | `/api/boxes/:id/exec` | `{command, timeout?}` | `sh -c` in `/workspace`; `timeout` seconds (default 120, max 600); a timeout answers `exit_code` 124, `timed_out: true` |
| PUT | `/api/boxes/:id/files` | `{path, content, encoding?}` | Write a file (up to 5 MB; `encoding: "base64"` for binary); relative paths are under `/workspace` |
| GET | `/api/boxes/:id/files` | `?path=` | Read a file (up to 1 MB; binary comes back base64) |
| POST | `/api/boxes/:id/stop` | | Stop it, keeping its disk and `/workspace` |
| DELETE | `/api/boxes/:id` | | Delete the box and its `/workspace` |

```json
POST /api/boxes/box_mG6f118Otufb/exec  {"command": "apt-get install -y -qq jq >/dev/null && jq --version"}
{ "success": true, "data": { "box_id": "box_mG6f118Otufb", "exit_code": 0, "stdout": "jq-1.6\n",
  "stderr": "", "duration_ms": 9131, "timed_out": false, "truncated": false } }
```

On a host that has not cached `BOX_IMAGE`, the API pulls it in the background at startup (about
1 GB unpacked; over 10 minutes on a busy host) and answers `503` to box creates until it is done,
so a client is told to retry instead of waiting out its own timeout. The language images follow
`BOX_IMAGE_WARMUP`: `auto` (the default) pulls them all at startup, each in its own background
task, on a host with 8 GB of memory and 40 GB free where microsandbox keeps images; a smaller
host pulls a language's image the first time a box asks for it, answering `503` to that create
(and to others for the same language) until it is cached. `all` and `default` force either way.

Measured on an M-series Mac (microsandbox's darwin-arm64 build): a box boots in ~0.3 s once
the image is cached, restarts after a stop in
~0.2 s, `apt-get update && apt-get install jq` takes 9 s. Before stopping a box the API runs
`sync` in it: without it, writes from the last seconds were lost on restart. `/workspace` is a
JuiceFS directory (`workspaces/<owner>/boxes/<box id>`) with `JFS_ENABLED=true`, otherwise a
host directory under `BOX_LOCAL_ROOT`; the rest of the disk lives with the microVM, so a box
restarted on another host keeps only `/workspace`. After an API restart, boxes still running are
reconnected; the rest are marked stopped.

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
loccibox box create                               # an agent box (prints its id)
loccibox box shell <box-id>                       # work in it interactively
loccibox box exec <box-id> -- python3 --version   # one command, its exit code
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
claude mcp add LocciBox \
  --scope local \
  --env LOCCIBOX_API_KEY=lbk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --env LOCCIBOX_API_URL=https://api-box.locci.cloud \
  -- loccibox mcp start
```

Available tools: `run_sandbox`, `get_sandbox_status`, `stop_sandbox`, and the agent box tools
`box_create`, `box_exec`, `box_write_file`, `box_read_file`, `box_stop` (`remove: true` deletes),
`box_list` (see [Agent boxes](#agent-boxes)). A box error (not found, limit reached) comes back
as a tool error the model can act on.

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
