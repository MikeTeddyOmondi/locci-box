# Locci Box - Setup Guide

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages:

- `express` - Web framework
- `microsandbox` - MicroVM execution SDK
- `pino` & `pino-http` - Structured logging
- `nanoid` - ID generation
- `cors` - CORS middleware
- `@modelcontextprotocol/sdk` - MCP server SDK
- TypeScript and development tools

### 2. Environment Setup

The `.env` file is already created with default values. You can modify it if needed:

```env
PORT=3000
NODE_ENV=development
ADMIN_API_KEY=admin_your_secret_key_here
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
DEFAULT_SANDBOX_TIMEOUT_SECONDS=30
DEFAULT_RATE_LIMIT_PER_MINUTE=60
LOG_LEVEL=info
MCP_ENABLED=true
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5757`

You should see output like:

```
[INFO] Locci Box API server started
[INFO] Default API key for testing: sk_test_default_key_12345
[INFO] Health check: http://localhost:5757/health
[INFO] API endpoint: http://localhost:5757/api/sandbox/run
```

### 4. Test the API

#### Health Check

```bash
curl http://localhost:5757/health
```

#### Run Python Code

```bash
curl -X POST http://localhost:5757/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from Locci Box!\")",
    "timeout": 30
  }'
```

#### Run Node.js Code

```bash
curl -X POST http://localhost:5757/api/sandbox/run \
  -H "Authorization: Bearer sk_test_default_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "node",
    "code": "console.log(\"Hello from Node.js!\")",
    "timeout": 30
  }'
```

#### Check Metrics (Admin)

```bash
curl http://localhost:5757/api/metrics \
  -H "Authorization: Bearer admin_your_secret_key_here"
```

## MCP Server Setup

### 1. Build the Project

```bash
npm run build
```

### 2. Start MCP Server

```bash
npm run mcp
```

### 3. Register with IBM Bob

```bash
claude mcp add --transport stdio locci-box -- node dist/mcp/server.js
```

## Project Structure

```
locci-box/
├── src/
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # HTTP server entry point
│   ├── routes/
│   │   ├── sandbox.ts            # POST /run, GET /:id/status, DELETE /:id
│   │   └── metrics.ts            # GET /metrics (admin)
│   ├── services/
│   │   ├── SandboxService.ts     # Wraps microsandbox SDK
│   │   └── TenantService.ts      # Multi-tenancy & usage tracking
│   ├── middleware/
│   │   ├── auth.ts               # API key validation
│   │   └── rateLimiter.ts        # Token bucket rate limiting
│   ├── mcp/
│   │   └── server.ts             # MCP server for AI agents
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   └── utils/
│       └── logger.ts             # Pino logger setup
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config
├── README.md                     # Main documentation
└── SETUP.md                      # This file
```

## Default Tenant

A default tenant is automatically created for development:

- **Tenant ID**: `tenant_default`
- **API Key**: `sk_test_default_key_12345`
- **Organization**: Default Organization
- **Max Concurrent Sandboxes**: 5
- **Rate Limit**: 60 requests/minute
- **Max Execution Time**: 30 seconds

## API Endpoints

| Method | Endpoint                  | Auth      | Description    |
| ------ | ------------------------- | --------- | -------------- |
| GET    | `/health`                 | None      | Health check   |
| POST   | `/api/sandbox/run`        | API Key   | Execute code   |
| GET    | `/api/sandbox/:id/status` | API Key   | Check status   |
| DELETE | `/api/sandbox/:id`        | API Key   | Stop sandbox   |
| GET    | `/api/metrics`            | Admin Key | System metrics |

## Rate Limiting

Rate limits are enforced per tenant using a token bucket algorithm:

- **Default**: 60 requests per minute
- **Configurable** per tenant in `TenantService`
- Returns `429 Too Many Requests` when exceeded
- Includes `retry_after` in response (seconds)

## Logging

Structured logging with Pino:

- **Development**: Pretty-printed colored output
- **Production**: JSON format for log aggregation
- **Levels**: trace, debug, info, warn, error, fatal

Example log:

```json
{
  "level": "info",
  "time": "2026-05-15T21:00:00.000Z",
  "sandbox_id": "sbox_abc123",
  "tenant_id": "tenant_default",
  "language": "python",
  "msg": "Sandbox created"
}
```

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing modules, run:

```bash
npm install
```

### Port Already in Use

If port 5757 is already in use, change it in `.env`:

```env
PORT=3001
```

### MCP Server Not Starting

Make sure you've built the project first:

```bash
npm run build
npm run mcp
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Start dev server: `npm run dev`
3. ✅ Test API with curl commands above
4. ✅ Check metrics endpoint
5. ✅ Build and start MCP server
6. 🔄 Integrate real microsandbox SDK (currently simulated)
7. 🔄 Add PostgreSQL for production
8. 🔄 Deploy to Fly.io or similar

## Production Checklist

Before deploying to production:

- [ ] Replace in-memory storage with PostgreSQL
- [ ] Add Redis for rate limiting
- [ ] Integrate real microsandbox SDK
- [ ] Set strong `ADMIN_API_KEY`
- [ ] Configure proper logging level
- [ ] Set up monitoring and alerts
- [ ] Add SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Add health check monitoring
- [ ] Configure log aggregation
- [ ] Set up error tracking (e.g., Sentry)

## Support

For issues or questions:

1. Check the logs: `npm run dev` shows detailed output
2. Review the README.md for API documentation
3. Check REFERENCE.MD for hackathon guidelines
