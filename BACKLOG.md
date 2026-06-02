# Backlog

## Features / Updates

- [x] **Downloads Page** — New web page showing users how to get the CLI. Options:
  - Pull the CLI Docker image from Docker Hub: `docker pull locci/box-cli` and run it with `docker run --rm -e LOCCIBOX_API_URL=... -e LOCCIBOX_API_KEY=... locci/box-cli --help`
  - Download prebuilt binaries hosted on GitHub Releases (Linux x64/arm64, macOS arm64)
  - Requires GitHub Actions workflows:
    - Release workflow: build CLI binaries and publish to GitHub Releases
    - Docker workflow: build and push `locci/box-api`, `locci/box-web`, `locci/box-cli` to Docker Hub on each release tag
  - Downloads page links reference Docker Hub images and GitHub Releases assets

- [x] **Dashboard — Real Stats + Persistent API Keys**
  - Show real metrics: actual sandbox runs, success/failure rates, execution times per tenant
  - Generate and persist real API keys per user (including the demo account)
  - Keys usable with CLI, MCP server, and SDK
  - Requires persistence via **Drizzle ORM + PGlite** (embedded Postgres, no external DB needed)
  - Schema: `users`, `api_keys`, `sandbox_runs`, `tenants`

- [x] **Downloads content on Landing Page** — Move/mirror the CLI download options (Docker pull + binary table) onto the main landing page so users can get the CLI without navigating away. The `/downloads` page can remain as the full detailed reference.

- [x] **Code Page — Mobile responsiveness**
  - Output section disappears on mobile after clicking Run — it should persist and render below the editor on small screens
  - File explorer should be collapsible/toggleable on mobile (hidden by default, toggled via a button) so the editor has full width
  - Layout: on mobile, file list toggle → full-width editor → output section stacked vertically
  - ~~File rename (double-click) doesn't work on touch screens~~ — fixed with pencil icon button

- [x] **Downloads Page — Binary table scrollable on mobile** — The releases/binary table overflows on small screens without horizontal scroll. Wrap the table in a horizontally scrollable container (`overflow-x: auto`) and ensure touch-scroll works.

- [x] **CLI — API Key Management** (`loccibox keys list/create/revoke`)
  - The backend `/api/keys` endpoints are fully implemented (GET, POST, PATCH /:id/revoke, DELETE /:id)
  - The CLI currently prints `⚠ API key management is not yet implemented in the backend.` — needs wiring to the real endpoints
  - CLI needs JWT from `loccibox login` (or stored token from `loccibox init`) passed as `Authorization: Bearer <jwt>`
  - Commands to implement in `cli/src/commands/keys.ts`:
    - `loccibox keys list` — GET /api/keys, display masked keys in a table
    - `loccibox keys create --name <name>` — POST /api/keys, print full key once
    - `loccibox keys revoke <key-id>` — PATCH /api/keys/:id/revoke
    - `loccibox keys delete <key-id>` — DELETE /api/keys/:id

- [x] **Code Page — Inline File Rename**

- [x] **MCP Server — Setup & Verification**
  - Tools: `run_sandbox`, `get_sandbox_status`, `stop_sandbox` — all pure HTTP calls to the REST API
  - Shared logic extracted to `src/mcp/tools.ts` (reused by API server and dev script)
  - **Transport architecture:**
    - **Streamable HTTP on main API** — `MCP_HTTP_ENABLED=true` mounts `POST /mcp` on the existing Express app (same port, same Docker container — no extra process or port)
    - **Standalone dev server** (`pnpm mcp:dev` / `pnpm mcp:inspect`) — starts its own HTTP server on `MCP_HTTP_PORT=3001` for local testing without running the full API
    - **stdio in CLI** — `loccibox mcp start` runs an in-process stdio MCP server for Claude Desktop / Cursor local connections
  - **CLI integration** (`@locci/box`, published to npm):
    - `loccibox mcp start` — stdio transport, self-contained, reads API URL + key from active profile
    - `loccibox mcp config` — prints ready-to-paste JSON config for Claude Desktop, Cursor, or any MCP client
  - **Client config** (or run `loccibox mcp config` to auto-generate):
    ```json
    { "mcpServers": { "locci-box": { "command": "loccibox", "args": ["mcp", "start"],
        "env": { "LOCCIBOX_API_URL": "https://your-api", "LOCCIBOX_API_KEY": "lbk_live_..." } } } }
    ```
  - **Env flags:** `MCP_HTTP_ENABLED=true/false` (default false), `MCP_HTTP_PORT=3001` (dev only)
  - TODO: end-to-end test via `pnpm mcp:inspect`, verify all 3 tools work with a live sandbox

## Dev / DX

- [ ] **CLI — Remove `~/.loccibox` migration shim** — The one-time migration from `~/.loccibox/config.json` → `~/.locci/box/config.json` added in v1.2.3 can be removed once the old path is no longer in circulation (target: next minor bump after ~2 versions).

- [ ] **PGlite auto-reset on corruption (dev only)** — add `DB_AUTO_RESET=true` env flag; on startup, if the initial schema migration throws, wipe `data/locci-box` and reinitialize automatically. Guard must be env-gated so it never fires in production.

## Production Hardening

- [x] Integrate real microsandbox SDK (was simulated in early build)
- [x] Set up CI/CD pipeline (GitHub Actions: ci.yml + release.yml)
- [x] Add comprehensive test suite (48 unit + integration tests via Vitest + supertest)
- [ ] **`compose.yaml` — postgres healthcheck + api `depends_on`** — On first boot the api starts before postgres is ready and gets `ECONNREFUSED`, then restarts and connects fine. Add `healthcheck` (`pg_isready`) on the postgres service and `depends_on: postgres: condition: service_healthy` on the api so Docker waits before starting the api.

- [x] **PGLite (dev) + PostgreSQL (prod) split — v1.4.0** — Two drizzle config files, one DB driver per environment. Plan:
  - `drizzle-dev.config.ts` — `dialect: "postgresql"`, `driver: "pglite"`, `dbCredentials: { url: DB_PATH }` (existing PGLite, zero setup)
  - `drizzle-prod.config.ts` — `dialect: "postgresql"`, `dbCredentials: { url: DATABASE_URL }` (real Postgres via `postgres` or `node-postgres`)
  - `src/db/index.ts` — conditional driver: `NODE_ENV === "production"` → `drizzle-orm/node-postgres`; otherwise → `drizzle-orm/pglite`
  - Add `postgres` (or `pg`) to prod dependencies; keep `@electric-sql/pglite` for dev only
  - Update `package.json` scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio` pass `--config=drizzle-dev.config.ts`; add `db:generate:prod` etc. for prod config
  - `compose.yaml` — add `postgres` service (image: `postgres:17-alpine`), bind volume for data, `DATABASE_URL` env wired to `api` service; remove `db-data` named volume
  - `.env` / `.env.example` — add `DATABASE_URL=postgres://locci:locci@localhost:5432/loccibox` for dev, real DSN for prod
  - `docs/DATABASE.md` — new doc explaining dev (PGLite, no setup) vs prod (Postgres), migration commands per environment, and how to run `db:migrate:prod`
  - `README.md` — update setup section to reflect Postgres requirement for prod; keep dev quickstart pointing at PGLite
  - Fixes the PGLite corruption risk that brought down prod in v1.3.0
- [x] **Sandbox network policy hardening** — replaced `NetworkPolicy.publicOnly()` with `defaultDeny` + domain allowlist (`pypi.org`, `files.pythonhosted.org`, `registry.npmjs.org`, `*.npmjs.org`, `*.alpinelinux.org`). Arbitrary public internet blocked; VPS origin IP no longer discoverable from sandbox code. All 6 security tests pass. Implemented in `src/services/SandboxService.ts`, documented in `SECURITY.md`.

- [ ] **Sandbox allowlist — Ruby gems** — `rubygems.org` and `*.rubygems.org` not yet in the domain allowlist. Ruby sandboxes can run code but `gem install` will fail. Add when Ruby runtime usage warrants it.

- [x] **JuiceFS persistent workspaces — v1.5.0** — `JFS_ENABLED=true` + Redis + external
  S3/RustFS mounts a per-user `/workspace` volume backed by JuiceFS into every sandbox.
  Enables stateful agent sessions, output artifact persistence, and per-user storage
  billing via `VolumeService.measureUsage()` (surfaced as `storage_bytes`/`storage_mib` on
  `GET /api/stats`). Fully opt-in: `docker compose --profile jfs up -d`; default
  `JFS_ENABLED=false` is a zero-change tmpfs fallback. Implemented in
  `src/services/VolumeService.ts`, wired into `src/services/SandboxService.ts`,
  `src/config/env.ts`, `src/routes/stats.ts`, `compose.yaml`, `.env.example`.
  Upgrade path: swap Redis metadata engine for TiKV for production HA.
- [ ] **Redis for rate limiting + caching** — move the in-process rate limiter to Redis so limits survive restarts and work across multiple API replicas
- [ ] **WebSocket support** — real-time output streaming for long-running sandbox executions instead of polling
- [ ] **Webhook notifications** — POST to a user-configured URL on sandbox job completion/failure
- [ ] **Prometheus metrics export** — expose `/metrics` in Prometheus format for Grafana dashboards and alerting
- [ ] **Sandbox snapshots + restore** — save and resume sandbox state across executions
  - Allow users to rename files directly in the file explorer
  - Click on the filename in place to edit it (inline input, confirm with Enter / cancel with Escape)
