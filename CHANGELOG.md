# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Dashboard — Real Stats + Persistent API Keys** (Drizzle ORM + PGlite):
  - All data persisted in embedded PGlite (no external DB required)
  - Schema: `tenants`, `users`, `api_keys`, `sandbox_runs` managed by Drizzle ORM
  - `drizzle-kit` added as dev dep; scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`
  - Initial migration: `drizzle/0000_glossy_power_pack.sql`
  - DB initialized via `migrate()` from `drizzle-orm/pglite/migrator` on startup
  - Docker volume `db-data` mounted at `/app/data` for persistence across restarts
  - `GET /api/stats` — real per-tenant stats (runs, success rate, avg ms, last 20 runs)
  - `GET /api/keys`, `POST /api/keys`, `PATCH /api/keys/:id/revoke`, `DELETE /api/keys/:id`
  - User API keys stored in `api_keys` table and accepted by auth middleware
  - Dashboard shows real metrics fetched from API; recent activity shows actual runs
  - Keys page fully backed by API — create, revoke, delete persist across sessions
  - Demo account updated to `box@locci.cloud` / `demo1234`
  - `DB_PATH` env var documented in `.env.example`

- **Code Page — Inline File Rename** — Double-click any filename in the file explorer sidebar to rename it inline. Confirm with Enter or blur, cancel with Escape. Ephemeral (state only, no persistence yet).
- **BACKLOG.md** — Created backlog tracking three upcoming features: Downloads page, Dashboard persistence, and Code page inline rename.

### Fixed

- `a1475e5` - **KVM access for child sandbox processes** — Added `privileged: true` to API container in compose, made `chmod 666 /dev/kvm` non-fatal (`|| true`) so container starts cleanly even when device permissions are managed by host udev rule.
- `c0ba3c6` - Added microsandbox binary (`msb`) to `PATH` in `docker-entrypoint.sh` and chmod `/dev/kvm` so child microVM processes can access the device.
- `952d996` - **Static asset serving** — Switched web container from `vite preview` to nginx + bun SSR dual-process: nginx serves `dist/client/assets/` with cache headers, proxies all other requests to the bun SSR handler on port 3001.
- `82bd860` / `fbb5790` — Reverted intermediate attempts at vite preview; settled on nginx + bun SSR as the correct production approach.
- `312a343` / `26486fe` / `308918d` / `c822304` - Added `allowedHosts` for `box.locci.cloud` to both `server` and `preview` in `vite.config.ts` to unblock reverse-proxy / Cloudflare Tunnel access.
- `0f2fc24` - Added `*.locci.cloud` and `locci.cloud` to CORS allowed origins in `src/app.ts`.
- `7cd3fb6` - **Proxy network** — Joined `proxy-network` external Docker bridge (shared with cloudflared) so both `locci-box-api` and `locci-box-web` are reachable by the Cloudflare Tunnel.
- `e599101` - **GLIBC compatibility** — Switched API Dockerfile base from `node:22-slim` (Debian Bookworm, GLIBC 2.36) to `ubuntu:24.04` (GLIBC 2.39) so the microsandbox native `.node` addon loads correctly.
- `38961f8` - Manually copy microsandbox native `.node` binary to `native/` dir after `--ignore-scripts` install using `find` + `cp`.
- `3facf31` - Used `--ignore-scripts` in `pnpm install` to bypass pnpm v11 build script approval block for esbuild and microsandbox.
- `dfa5d89` / `514a046` / `78a51db` - Multiple attempts to unblock pnpm install for esbuild/microsandbox build scripts; settled on `--ignore-scripts` with manual binary copy.
- `7ad5c24` - Updated share URL to `box.locci.cloud`.

### Added

- **Microsandbox Execution Fix** - Proper language-specific code execution:
  - Implemented `sandbox.exec()` with language-specific interpreters (python3, node, ruby)
  - Added `getExecutionCommand()` method to generate proper command and args for each language
  - Python: `python3 -c "code"`, Node: `node -e "code"`, Ruby: `ruby -e "code"`
  - Bash continues to use `sandbox.shell()` for direct shell execution
  - Fixes issue where all code was executed as shell commands, causing syntax errors
- `5ba6fc2` - **Microsandbox SDK Integration** - Real hardware-isolated microVM execution:
  - Replaced simulated execution with actual microsandbox SDK (v0.4.6)
  - Implemented `Sandbox.builder()` pattern for microVM creation
  - Configured language-specific Docker images (python:3.11-slim, node:20-alpine, bash:5.2, ruby:3.2-alpine)
  - Added proper sandbox lifecycle management (create → execute → cleanup)
  - Implemented environment variable support via builder pattern
  - Fixed ExecOutput API usage: `result.code`, `result.stdout()`, `result.stderr()`
  - Added timeout detection and graceful error handling
  - Fixed iterator issues with `Array.from()` for Map iterations
- `8dc6a95` - **ESM Migration** - Migrated entire project from CommonJS to ESM:
  - Added `"type": "module"` to package.json (required for microsandbox SDK)
  - Changed TypeScript module from `"commonjs"` to `"ES2022"`
  - Added `.js` extensions to all relative imports (ESM requirement)
  - Fixed TypeScript compilation errors for ESM compatibility
- `c84304c` - Added `.js` extensions to imports in core files (app.ts, server.ts, mcp/server.ts)
- `432c5f1` - Added `.js` extensions and explicit Router type annotations to route files
- `3efe5e4` - Added `.js` extensions to middleware imports and fixed unused parameter warnings
- `f68558d` - Added `.js` extensions to utils and service imports

### Added

- `52b27be` - **CLI Tool Implementation** - Complete command-line interface for Locci Box:
  - Interactive setup wizard (`loccibox init`) with Clack prompts
  - Run command with inline code, file input, and interactive modes
  - Status command to check sandbox execution status
  - Stop command to terminate running sandboxes
  - Metrics command to view usage statistics
  - Keys command stub for future API key management
  - Multi-profile configuration support (`~/.loccibox/config.json`)
  - Environment variable fallbacks (`LOCCIBOX_API_URL`, `LOCCIBOX_API_KEY`)
  - Beautiful terminal UI with spinners, colors, and formatted tables
  - Comprehensive error handling with user-friendly messages
  - Full TypeScript support with type safety
  - Modular architecture for easy extension
- `52b27be` - Created `cli/` directory with complete CLI implementation:
  - `cli/src/index.ts` - Main CLI entry point with Commander.js
  - `cli/src/commands/` - All command implementations
  - `cli/src/lib/api.ts` - API client wrapper with typed responses
  - `cli/src/lib/config.ts` - Configuration management
  - `cli/src/lib/output.ts` - Terminal formatting utilities
  - `cli/src/types/index.ts` - TypeScript type definitions
  - `cli/README.md` - Comprehensive CLI documentation
- `52b27be` - Configured monorepo with pnpm workspaces
- `52b27be` - Updated root README.md with CLI section and usage examples
- `2c09252` - Added `dotenv` package (v17.4.2) for automatic environment variable loading
- `52bcc1c` - Integrated dotenv configuration in `src/config/env.ts` to load `.env` file automatically
- `1c94f44` - Created CHANGELOG.md documenting all project changes
- `8925e5a` - Created MIT LICENSE file for the project
- `02d61c2` - Created `src/routes/health.ts` - Dedicated health check router for better modularity
- `c9b03ab` - Created `src/middleware/errorHandler.ts` - Typed error handler with custom error classes:
  - `AppError` - Base application error class
  - `ValidationError` - 400 Bad Request errors
  - `UnauthorizedError` - 401 Unauthorized errors
  - `ForbiddenError` - 403 Forbidden errors
  - `NotFoundError` - 404 Not Found errors
  - `RateLimitError` - 429 Rate Limit errors with retry_after support
  - `ServiceUnavailableError` - 503 Service Unavailable errors
- `c4c21e8` - Created `src/middleware/notFoundHandler.ts` - Dedicated 404 handler middleware

### Changed

- `52b27be` - Project structure now uses monorepo architecture with separate backend and CLI packages
- `52b27be` - Updated project documentation to reflect CLI availability
- `52bcc1c` - Environment variables are now automatically loaded from `.env` file on application startup
- `52bcc1c` - No manual environment variable setup required in development
- `6014ac4` - **Refactored `src/app.ts`** - Complete restructuring for better maintainability:
  - Extracted `configureMiddleware()` helper function for middleware setup
  - Extracted `configureRoutes()` helper function for route configuration
  - Replaced inline health check with dedicated router
  - Replaced generic error handler with typed error handler
  - Replaced inline 404 handler with dedicated middleware
  - Simplified `createApp()` function to 10 lines (from 57 lines)
  - Improved code organization and separation of concerns

### Improved

- `52b27be` - Developer experience with intuitive CLI commands and beautiful terminal output
- `52b27be` - Easier API interaction without writing curl commands
- `52b27be` - Better error messages and user guidance in CLI
- `c9b03ab` - Better error categorization and debugging with custom error classes
- `02d61c2` - Easier to test individual components (health checks, error handling, etc.)
- `6014ac4` - Clearer overview of middleware stack and route configuration
- `6014ac4` - More maintainable and extensible codebase
- `6014ac4` - Consistent pattern across all routes and middleware

## [1.0.0] - 2026-05-15

### Initial Release

#### Core Features

- B2B API for safe code execution in isolated microVMs
- Support for Python, Node.js, Bash, and Ruby
- Multi-tenant architecture with API key authentication
- Rate limiting with token bucket algorithm
- Sandbox execution with configurable timeouts
- Health check and metrics endpoints
- MCP (Model Context Protocol) server integration
- Comprehensive logging with Pino
- Type-safe environment configuration with Valibot

#### Commit History

- `2c09252` - feat: add dotenv package (v17.4.2) for environment variable loading
- `52bcc1c` - feat: integrate dotenv.config() in env.ts for automatic .env file loading
- `1c94f44` - docs: create CHANGELOG.md documenting all project changes
- `eb2eca8` - chore: add project configuration and documentation files
- `8882ec4` - docs: add documentation, examples, and test files
- `9a18973` - feat: add core application services, types, and server setup
- `8e2f03e` - feat: add authentication and rate limiting middleware
- `483e827` - feat: add sandbox and metrics API routes
- `8925e5a` - docs: add MIT LICENSE and CLI reference documentation
- `02d61c2` - refactor: extract health check to dedicated router (see CHANGELOG.md)
- `c9b03ab` - refactor: add typed error handler with custom error classes (see CHANGELOG.md)
- `c4c21e8` - refactor: extract 404 handler to dedicated middleware (see CHANGELOG.md)
- `6014ac4` - refactor: restructure createApp with helper functions and modular design (see CHANGELOG.md)
