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
- [ ] **Replace PGlite with PostgreSQL** — swap `drizzle-orm/pglite` driver for `drizzle-orm/node-postgres`; same schema, adds crash recovery, concurrent access, and proper prod reliability
- [ ] **Redis for rate limiting + caching** — move the in-process rate limiter to Redis so limits survive restarts and work across multiple API replicas
- [ ] **WebSocket support** — real-time output streaming for long-running sandbox executions instead of polling
- [ ] **Webhook notifications** — POST to a user-configured URL on sandbox job completion/failure
- [ ] **Prometheus metrics export** — expose `/metrics` in Prometheus format for Grafana dashboards and alerting
- [ ] **Sandbox snapshots + restore** — save and resume sandbox state across executions
  - Allow users to rename files directly in the file explorer
  - Click on the filename in place to edit it (inline input, confirm with Enter / cancel with Escape)
