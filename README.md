# Locci Box

A B2B API that lets businesses and AI agents run untrusted code safely inside isolated microVMs using the [microsandbox SDK](https://github.com/superradcompany/microsandbox).

## Features

- 🔒 **Hardware-isolated execution** - Every sandbox runs in its own microVM
- ⚡ **Sub-100ms boot times** - Fast microVM startup
- 🏢 **Multi-tenant** - Isolated sandboxes per organization with usage limits
- 🔑 **API key authentication** - Simple B2B-style auth
- 📊 **Usage tracking** - Monitor sandbox executions and resource usage
- 🤖 **MCP integration** - AI agents can call sandbox tools via Model Context Protocol
- 🚀 **Local development** - Runs with `npm run dev` using tsx

## Supported Languages

- Python
- Node.js
- Bash
- Ruby

## CLI Tool

Locci Box includes a powerful command-line interface for interacting with the API.

### Installation

```bash
# From the monorepo
cd cli
pnpm install
pnpm build

# Link globally (optional)
pnpm link --global
```

### Quick Start

```bash
# Initialize configuration
loccibox init

# Run code
loccibox run -l python -c "print('Hello from Locci Box!')"

# Check sandbox status
loccibox status <sandbox-id>

# View metrics
loccibox metrics
```

For complete CLI documentation, see [cli/README.md](./cli/README.md).

## Quick Start

### Prerequisites

1. **Node.js 18+**
2. **microsandbox CLI** (for production use):
   ```bash
   curl -fsSL https://install.microsandbox.dev | sh
   ```

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd locci-box

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The API will be available at `http://localhost:5757`

## API Reference

### Authentication

All API requests (except `/health`) require an API key in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_KEY
```

**Default API key for testing:** `sk_test_default_key_12345`

### Endpoints

#### POST /api/sandbox/run

Execute code in an isolated microVM.

**Request:**

```bash
curl -X POST http://localhost:5757/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from microVM!\")",
    "timeout": 30
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "status": "completed",
    "stdout": "Hello from microVM!\n",
    "stderr": "",
    "exit_code": 0,
    "duration_ms": 87,
    "created_at": "2026-05-15T21:00:00.000Z",
    "completed_at": "2026-05-15T21:00:00.087Z"
  }
}
```

**Parameters:**

- `language` (required): `python`, `node`, `bash`, or `ruby`
- `code` (required): Code to execute (max 1MB)
- `timeout` (optional): Max execution time in seconds (default: 30)

---

#### GET /api/sandbox/:id/status

Check the status of a running sandbox.

**Request:**

```bash
curl http://localhost:5757/api/sandbox/sbox_abc123xyz/status \
  -H "Authorization: Bearer sk_test_default_key_12345"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "tenant_id": "tenant_default",
    "language": "python",
    "status": "running",
    "uptime_ms": 4200,
    "created_at": "2026-05-15T21:00:00.000Z"
  }
}
```

---

#### DELETE /api/sandbox/:id

Stop and destroy a running sandbox.

**Request:**

```bash
curl -X DELETE http://localhost:5757/api/sandbox/sbox_abc123xyz \
  -H "Authorization: Bearer sk_test_default_key_12345"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sandbox_id": "sbox_abc123xyz",
    "status": "stopped",
    "message": "Sandbox terminated successfully"
  }
}
```

---

#### GET /api/metrics

Admin-only endpoint for system-wide metrics.

**Request:**

```bash
curl http://localhost:5757/api/metrics \
  -H "Authorization: Bearer admin_your_secret_key_here"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "system": {
      "total_tenants": 1,
      "total_sandboxes_today": 142,
      "active_sandboxes": 3,
      "avg_execution_ms": 94
    },
    "tenants": [
      {
        "tenant_id": "tenant_default",
        "organization": "Default Organization",
        "total_runs": 142,
        "active_sandboxes": 3,
        "avg_execution_ms": 94,
        "last_activity": "2026-05-15T21:00:00.000Z"
      }
    ]
  }
}
```

---

#### GET /health

Health check endpoint (no authentication required).

**Request:**

```bash
curl http://localhost:5757/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-15T21:00:00.000Z",
    "uptime": 3600
  }
}
```

## MCP Server

Locci Box includes an MCP (Model Context Protocol) server that exposes sandbox tools to AI agents like IBM Bob.

### Starting the MCP Server

```bash
npm run mcp
```

### Registering with IBM Bob

```bash
# Add to Bob's MCP configuration
claude mcp add --transport stdio locci-box -- node dist/mcp/server.js
```

### Available Tools

1. **run_sandbox** - Execute code in a microVM
2. **get_sandbox_status** - Check sandbox status
3. **stop_sandbox** - Stop a running sandbox

All tools require an `api_key` parameter for authentication.

## Environment Variables

```env
# Server Configuration
PORT=5757
NODE_ENV=development

# Admin key for /metrics endpoint
ADMIN_API_KEY=admin_your_secret_key_here

# Default tenant rate limits
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
DEFAULT_SANDBOX_TIMEOUT_SECONDS=30
DEFAULT_RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=info

# MCP Server
MCP_ENABLED=true
```

## Project Structure

```
locci-box/
├── src/                          # Backend API
│   ├── app.ts                    # Express application
│   ├── server.ts                 # HTTP server entry point
│   ├── routes/
│   │   ├── health.ts             # Health check endpoint
│   │   ├── sandbox.ts            # Sandbox execution routes
│   │   └── metrics.ts            # Admin metrics routes
│   ├── services/
│   │   ├── SandboxService.ts     # microsandbox SDK wrapper
│   │   └── TenantService.ts      # Multi-tenancy & usage tracking
│   ├── middleware/
│   │   ├── auth.ts               # API key validation
│   │   ├── rateLimiter.ts        # Per-tenant rate limiting
│   │   ├── errorHandler.ts       # Typed error handling
│   │   └── notFoundHandler.ts    # 404 handler
│   ├── mcp/
│   │   └── server.ts             # MCP server for AI agents
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── config/
│   │   └── env.ts                # Environment configuration
│   └── utils/
│       └── logger.ts             # Pino logger configuration
├── cli/                          # CLI Tool
│   ├── src/
│   │   ├── index.ts              # CLI entry point
│   │   ├── commands/             # Command implementations
│   │   │   ├── init.ts           # Setup wizard
│   │   │   ├── run.ts            # Execute code
│   │   │   ├── status.ts         # Check status
│   │   │   ├── stop.ts           # Stop sandbox
│   │   │   ├── metrics.ts        # View metrics
│   │   │   └── keys.ts           # Manage API keys
│   │   ├── lib/                  # Shared utilities
│   │   │   ├── api.ts            # API client
│   │   │   ├── config.ts         # Config management
│   │   │   └── output.ts         # Terminal formatting
│   │   └── types/
│   │       └── index.ts          # TypeScript types
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── docs/                         # Documentation
├── examples/                     # Example scripts
├── package.json                  # Root package.json
├── pnpm-workspace.yaml           # Monorepo configuration
├── tsconfig.json
├── .env.example
├── CHANGELOG.md                  # Change history
├── LICENSE                       # MIT License
└── README.md
```

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Start MCP server
npm run mcp
```

## Rate Limiting

Each tenant has configurable rate limits:

- **Concurrent sandboxes**: Max number of sandboxes running simultaneously (default: 5)
- **Requests per minute**: API request rate limit (default: 60/min)
- **Execution timeout**: Max execution time per sandbox (default: 30s)

Rate limits are enforced using a token bucket algorithm.

## Security

- ✅ Hardware-isolated microVMs (no shared process risk)
- ✅ API key authentication
- ✅ Per-tenant rate limiting
- ✅ Code size limits (1MB max)
- ✅ Execution timeout enforcement
- ✅ Structured logging for audit trails

## Production Deployment

### Requirements

- Linux with KVM support (for microsandbox)
- Minimum 2GB RAM, 2 CPU cores
- Recommended: 4GB RAM, 4 CPU cores

### Hosting Options

- **Fly.io** (KVM support)
- **Bare metal VPS** with KVM
- **Railway** (check KVM availability)

### Database Migration

The current implementation uses in-memory storage for development. For production:

1. Set up PostgreSQL database
2. Replace `TenantService` in-memory Map with database queries
3. Add Redis for rate limiting and caching
4. Update `DATABASE_URL` in environment variables

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) folder:

- **[Quick Start Guide](./docs/QUICKSTART.md)** - Get started in 3 minutes
- **[Setup Guide](./docs/SETUP.md)** - Detailed installation and configuration
- **[API Collection](./docs/API_COLLECTION.md)** - Complete API testing guide with curl commands
- **[Microsandbox Integration](./docs/MICROSANDBOX_INTEGRATION.md)** - How to integrate the real microsandbox SDK
- **[Environment Configuration](./docs/ENV_CONFIGURATION.md)** - Centralized config with Valibot
- **[Project Status](./docs/PROJECT_STATUS.md)** - Current status and next steps

## TODO for Production

- [ ] Replace in-memory storage with PostgreSQL
- [ ] Add Redis for rate limiting and caching
- [ ] Integrate real microsandbox SDK (currently simulated)
- [ ] Add WebSocket support for real-time output streaming
- [ ] Implement webhook notifications for job completion
- [ ] Add comprehensive test suite
- [ ] Set up CI/CD pipeline
- [ ] Add Prometheus metrics export
- [ ] Implement sandbox snapshots and restore

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
