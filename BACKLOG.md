# Backlog

## Features / Updates

- [ ] **Downloads Page** — New web page showing users how to get the CLI. Options:
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

- [x] **Code Page — Inline File Rename**
  - Allow users to rename files directly in the file explorer
  - Click on the filename in place to edit it (inline input, confirm with Enter / cancel with Escape)
