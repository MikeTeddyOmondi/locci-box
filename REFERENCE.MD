# Building a B2B SaaS Product with IBM Bob + Microsandbox

> A team guide for the IBM Bob Hackathon (May 15–17, 2026)  
> Stack: **IBM Bob** · **Microsandbox** · **Express.js** · **TypeScript** · **Lovable (UI)**

---

## Table of Contents

1. [What We're Building](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#what-were-building)
2. [Tech Stack Overview](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#tech-stack-overview)
3. [Architecture](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#architecture)
4. [IBM Bob — Backend Scaffold Prompt](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#ibm-bob--backend-scaffold-prompt)
5. [IBM Bob — Follow-Up Prompts](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#ibm-bob--follow-up-prompts)
6. [Lovable — UI Prompt](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#lovable--ui-prompt)
7. [Project File Structure](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#project-file-structure)
8. [Core API Reference](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#core-api-reference)
9. [How Bob + Microsandbox Work Together](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#how-bob--microsandbox-work-together)
10. [Hackathon Submission Checklist](https://claude.ai/chat/15134848-a4fb-4d1c-b085-a383a4d587d5#hackathon-submission-checklist)

---

## What We're Building

A **B2B SaaS platform** that allows businesses and AI agents to execute untrusted code safely inside hardware-isolated microVMs — powered by **Microsandbox** as the execution layer, **Express.js** as the API layer, and **IBM Bob** as the AI development partner that builds and iterates on the codebase.

**Core value proposition:** Every agent or tenant gets their own isolated computer. No shared process risk. No secret leakage. Sub-100ms VM boot times.

---

## Tech Stack Overview

| Layer | Technology |
| --- | --- |
| AI Dev Partner | IBM Bob |
| Backend API | Express.js + TypeScript |
| Sandbox Execution | Microsandbox SDK (`npm i microsandbox`) |
| Agent Protocol | MCP (Model Context Protocol) |
| Auth | API Key-based (B2B) |
| Logging | Pino |
| UI  | Lovable (React, generated) |
| Hosting (demo) | Railway / Render / Fly.io |

---

## Architecture

```
Developer / AI Agent
        │
        ▼
  Express.js API  ◄──── API Key Auth + Rate Limiting
        │
        ├── POST /sandbox/run
        ├── GET  /sandbox/:id/status
        └── DELETE /sandbox/:id
              │
              ▼
      SandboxService.ts
      (wraps microsandbox SDK)
              │
              ▼
      microsandbox microVM
      (hardware-isolated, <100ms boot)
              │
        Code executes safely
        inside isolated VM
              │
              ▼
        Output returned to API
```

IBM Bob connects to this stack via the **MCP server** that runs alongside Express, allowing Bob itself to call sandbox tools as an agent.

---

## IBM Bob — Backend Scaffold Prompt

> **How to use:** Open IBM Bob in your IDE, switch to **Architect** or **Code** agentic mode, paste the prompt below into the chat panel, and review/approve each file as Bob generates it.

```
I want to build a B2B SaaS product called SandboxAPI.

The product allows businesses to run untrusted code or AI agent tasks
safely using microsandbox (https://github.com/superradcompany/microsandbox)
as the execution layer.

Tech stack:
- Backend: Express.js (Node.js)
- Sandbox layer: microsandbox TypeScript SDK (`npm i microsandbox`)
- Auth: API key-based (B2B style)
- Multi-tenancy: each tenant/org gets isolated sandboxes

Please scaffold the full project structure including:

1. Express.js app entry point (src/app.ts)
2. Routes: POST /sandbox/run, GET /sandbox/:id/status, DELETE /sandbox/:id
3. Middleware: API key auth, rate limiting per tenant
4. A SandboxService class that wraps the microsandbox SDK
5. Error handling middleware
6. A .env.example file
7. package.json with all dependencies

Use TypeScript throughout. Follow B2B SaaS best practices.
```

---

## IBM Bob — Follow-Up Prompts

Run these **one at a time** after Bob completes each step. Always review Bob's output before moving to the next prompt.

---

### Prompt 2 — Tenant Isolation

```
Now add a TenantService that tracks sandbox usage per API key.
Each tenant should have a max concurrent sandboxes limit (configurable).
Store tenant config in memory for now with a TODO comment to swap
for a database (Postgres/Redis) in production.
```

---

### Prompt 3 — MCP Server

```
Add an MCP server alongside the Express app using
@modelcontextprotocol/sdk that exposes the same sandbox tools
(run, status, stop) so AI agents like IBM Bob itself can call
this service via MCP protocol. Place it in src/mcp/server.ts.
```

---

### Prompt 4 — Logging & Metrics

```
Add structured logging using pino throughout the app.
Also add a GET /metrics endpoint that returns per-tenant
sandbox usage stats: total runs, active sandboxes, and
average execution time. Protect this endpoint with an
admin API key from the environment variables.
```

---

### Prompt 5 — Tests

```
Add integration tests using Jest and supertest for the three
main routes: POST /sandbox/run, GET /sandbox/:id/status, and
DELETE /sandbox/:id. Mock the microsandbox SDK so tests don't
require a real microVM. Place tests in src/__tests__/.
```

---

### Prompt 6 — README

```
Generate a README.md that explains what SandboxAPI does,
how to get an API key, the full API reference for all endpoints
with example curl commands, environment variable documentation,
and a quickstart section. Write it for a technical B2B audience
(developers at companies evaluating the product).
```

---

### Prompt 7 — Docker & Deploy

```
Add a Dockerfile for the Express app and a docker-compose.yml
that runs the API service. Include a .dockerignore file.
Add a deploy section to the README explaining how to run it
on Railway or Render with one click.
```

---

## Lovable — UI Prompt

> **How to use:** Go to [lovable.dev](https://lovable.dev/), start a new project, and paste the prompt below. Lovable will generate the full React dashboard UI. Connect it to your Express API via the base URL in environment variables.

```
Build a B2B SaaS dashboard for a product called SandboxAPI.

SandboxAPI lets businesses safely run code in isolated microVMs
via a REST API. The dashboard is for developers and team leads
who manage API access and monitor sandbox usage.

Pages and features to build:

1. LANDING / LOGIN PAGE
   - Clean, technical B2B aesthetic (dark theme preferred)
   - Hero: "Every agent deserves its own computer"
   - Subheading explaining isolated microVM execution
   - "Get API Key" CTA button
   - Simple email + password login form

2. DASHBOARD HOME (after login)
   - Stats cards: Total Runs Today, Active Sandboxes,
     Avg Execution Time, API Calls This Month
   - Line chart: sandbox runs over the last 7 days
   - Recent activity table: timestamp, language, status,
     duration, tenant ID

3. API KEYS PAGE
   - Table of API keys with name, created date, last used,
     status (active/revoked)
   - "Create New Key" button with a modal: name the key,
     set rate limit (sandboxes per minute)
   - Copy-to-clipboard for key values
   - Revoke key button with confirmation dialog

4. SANDBOX PLAYGROUND PAGE
   - Code editor (use a Monaco-style editor component)
   - Language selector: Python, Node.js, Bash, Ruby
   - "Run in Sandbox" button
   - Output panel showing stdout, stderr, exit code,
     and execution time
   - Connect to POST /sandbox/run on the backend API

5. DOCS PAGE (inline)
   - API reference with curl examples for all three endpoints
   - Quickstart section
   - Code samples in Python and TypeScript

Design requirements:
- Dark theme with blue/purple gradient accents
- Responsive layout (desktop-first, but mobile-friendly)
- Use shadcn/ui components
- Professional B2B feel — think Vercel, Railway, or Supabase
  dashboard aesthetic
- All API calls should use a configurable VITE_API_BASE_URL
  environment variable
```

---

## Project File Structure

```
sandbox-api/
├── src/
│   ├── app.ts                    ← Express entry point
│   ├── routes/
│   │   └── sandbox.ts            ← /sandbox/* routes
│   ├── services/
│   │   ├── SandboxService.ts     ← wraps microsandbox SDK
│   │   └── TenantService.ts      ← multi-tenancy + usage tracking
│   ├── middleware/
│   │   ├── auth.ts               ← API key validation
│   │   └── rateLimiter.ts        ← per-tenant rate limiting
│   ├── mcp/
│   │   └── server.ts             ← MCP server for agent access
│   ├── types/
│   │   └── index.ts              ← shared TypeScript types
│   └── __tests__/
│       └── sandbox.test.ts       ← integration tests
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Core API Reference

### `POST /sandbox/run`

Spin up a microVM, execute code, return output.

```bash
curl -X POST https://your-api.com/sandbox/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from a microVM!\")",
    "timeout": 30
  }'
```

**Response:**

```json
{
  "sandbox_id": "sbox_abc123",
  "stdout": "Hello from a microVM!\n",
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 87
}
```

---

### `GET /sandbox/:id/status`

Check whether a sandbox is still running.

```bash
curl https://your-api.com/sandbox/sbox_abc123/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "sandbox_id": "sbox_abc123",
  "status": "running",
  "uptime_ms": 4200
}
```

---

### `DELETE /sandbox/:id`

Stop and destroy a sandbox.

```bash
curl -X DELETE https://your-api.com/sandbox/sbox_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "sandbox_id": "sbox_abc123",
  "status": "stopped"
}
```

---

### `GET /metrics` *(admin only)*

Per-tenant usage stats.

```bash
curl https://your-api.com/metrics \
  -H "Authorization: Bearer ADMIN_API_KEY"
```

**Response:**

```json
{
  "tenants": [
    {
      "api_key_prefix": "sk_live_abc...",
      "total_runs": 142,
      "active_sandboxes": 3,
      "avg_execution_ms": 94
    }
  ]
}
```

---

## How Bob + Microsandbox Work Together

```
1. Developer describes intent to Bob in natural language
        │
2. Bob reasons about task using full repo context
        │
3. Bob decides to run/test code → calls MCP sandbox tool
        │
4. microsandbox spins up a microVM in <100ms
        │
5. Code executes inside complete hardware isolation
        │
6. Output returned to Bob → Bob interprets result
        │
7. Bob applies changes to repo or suggests next steps
        │
8. VM is torn down automatically
```

**Key benefit:** Bob never runs untrusted or experimental code on your host machine. Every execution is sandboxed, isolated, and disposable.

---

## Connecting the MCP Server to Bob

Once your MCP server is running (Prompt 3 above), register it with Bob:

```bash
claude mcp add --transport stdio microsandbox -- npx -y microsandbox-mcp
```

To use your **custom** MCP server instead:

```bash
claude mcp add --transport stdio sandboxapi -- node dist/mcp/server.js
```

---

## Environment Variables

```env
# .env.example

PORT=3000
NODE_ENV=development

# Admin key for /metrics endpoint
ADMIN_API_KEY=admin_your_secret_key_here

# Default tenant rate limits
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
DEFAULT_SANDBOX_TIMEOUT_SECONDS=30

# Future: swap in-memory tenant store for DB
DATABASE_URL=postgresql://user:pass@localhost:5432/sandboxapi
```

---

## Hackathon Submission Checklist

- [ ] IBM Bob used meaningfully across the build (not just for boilerplate)
- [ ] Bob session report exported and included in GitHub repo
- [ ] Public GitHub repository with all source code
- [ ] Demo video recorded (3–5 minutes, show the full sandbox run loop)
- [ ] Slide presentation prepared
- [ ] Live demo URL working (Railway / Render / Fly.io)
- [ ] Lovable UI connected to live API
- [ ] README with API reference and quickstart
- [ ] Project submitted on lablab.ai before **May 17, 2026**

---

## Tips for Working with Bob

- **Be specific about files** — tell Bob exactly which file to create or edit
- **One prompt at a time** — don't stack multiple features in one prompt
- **Use repo context** — once files exist, reference them by name: *"look at SandboxService.ts and add error handling for when the microVM fails to boot"*
- **Approve before applying** — always review Bob's diff, especially for auth and tenant logic
- **Export the Bob report** — go to Bob's session history and export before the deadline; it's a required submission artifact

---

*Built for the IBM Bob Hackathon · lablab.ai · May 15–17, 2026*

---

## Local Setup in 4 Steps

Running locally is the smartest move for a 48-hour hackathon. Here's the full local setup:

### Step 1 — Install microsandbox CLI

```bash
curl -fsSL https://install.microsandbox.dev | sh
```

> **Requirements:** Linux with KVM enabled, or macOS with Apple Silicon. If you're on macOS Intel or Windows, you'll need a Linux VM or WSL2 with KVM.

---

### Step 2 — Scaffold the Express app with Bob

Give Bob this prompt first:

```
Scaffold a local Express.js + TypeScript project that uses the 
microsandbox SDK. No Docker, no cloud. It should run with 
`npm run dev` using ts-node or tsx. Include a .env file 
with PORT=3000.
```

Then install deps manually:

```bash
npm i microsandbox express
npm i -D typescript tsx @types/express @types/node
```

---

### Step 3 — Run the API locally

```bash
npm run dev
# Express running on http://localhost:3000
```

---

### Step 4 — Expose it for the Lovable UI with ngrok

```bash
# Install ngrok if you don't have it
npm i -g ngrok

ngrok http 3000
# gives you https://abc123.ngrok.io ← use this as VITE_API_BASE_URL in Lovable
```

---

## Local `.env` to Use

```env
PORT=3000
NODE_ENV=development
ADMIN_API_KEY=admin_secret
DEFAULT_MAX_CONCURRENT_SANDBOXES=5
DEFAULT_SANDBOX_TIMEOUT_SECONDS=30
```

---

## What This Looks Like End-to-End Locally

```
Lovable UI (browser)
      │
      ▼
http://localhost:3000  (Express API)
      │
      ▼
microsandbox SDK
      │
      ▼
microVM spins up locally on your machine
(<100ms, uses your machine's KVM)
      │
      ▼
code executes → output returned → VM destroyed
```

Clean, fast, zero infrastructure cost — perfect for a hackathon demo. When the judges watch your video they won't know or care that it's local, they care about the working demo.

---

## One Thing to Add to Bob's Prompt

Since you're running locally, add this line to your Bob scaffold prompt:

```
This will run locally for now. Do not add any cloud SDK dependencies 
or assume a hosted environment. All microsandbox calls should use 
the local SDK directly. Add a note in the README that production 
deployment requires a KVM-enabled host (Fly.io or bare metal VPS).
```

---