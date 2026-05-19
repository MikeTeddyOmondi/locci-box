#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * MCP Server for Locci Box
 * Thin HTTP client over the Locci Box REST API — no DB dependency.
 * Supports stdio transport (Claude Desktop) and streamable HTTP transport (API clients).
 */

const API_BASE = (process.env.LOCCIBOX_API_URL ?? "http://localhost:5757").replace(/\/$/, "");

async function apiRequest<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers as Record<string, string>),
    },
  });
  const data = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!data.success) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.data as T;
}

// Tool definitions
const tools = [
  {
    name: "run_sandbox",
    description:
      "Execute code in an isolated microVM. Returns stdout, stderr, and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: ["python", "node", "bash", "ruby"],
          description: "Programming language to execute",
        },
        code: {
          type: "string",
          description: "Code to execute in the sandbox",
        },
        timeout: {
          type: "number",
          description: "Maximum execution time in seconds (default: 30)",
          default: 30,
        },
        api_key: {
          type: "string",
          description: "API key for authentication (falls back to LOCCIBOX_API_KEY env var)",
        },
      },
      required: ["language", "code"],
    },
  },
  {
    name: "get_sandbox_status",
    description: "Check the status of a running sandbox",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_id: {
          type: "string",
          description: "Sandbox ID to check",
        },
        api_key: {
          type: "string",
          description: "API key for authentication (falls back to LOCCIBOX_API_KEY env var)",
        },
      },
      required: ["sandbox_id"],
    },
  },
  {
    name: "stop_sandbox",
    description: "Stop and destroy a running sandbox",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_id: {
          type: "string",
          description: "Sandbox ID to stop",
        },
        api_key: {
          type: "string",
          description: "API key for authentication (falls back to LOCCIBOX_API_KEY env var)",
        },
      },
      required: ["sandbox_id"],
    },
  },
];

function resolveKey(argsKey?: string): string {
  const key = argsKey ?? process.env.LOCCIBOX_API_KEY ?? env.ADMIN_API_KEY;
  if (!key) throw new Error("No API key provided. Pass api_key in args or set LOCCIBOX_API_KEY.");
  return key;
}

async function handleRunSandbox(args: any) {
  const { language, code, timeout, api_key } = args;
  const result = await apiRequest("/api/sandbox/run", resolveKey(api_key), {
    method: "POST",
    body: JSON.stringify({ language, code, timeout: timeout ?? 30 }),
  });
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function handleGetStatus(args: any) {
  const { sandbox_id, api_key } = args;
  const result = await apiRequest(`/api/sandbox/${sandbox_id}/status`, resolveKey(api_key));
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function handleStopSandbox(args: any) {
  const { sandbox_id, api_key } = args;
  await apiRequest(`/api/sandbox/${sandbox_id}`, resolveKey(api_key), { method: "DELETE" });
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ sandbox_id, status: "stopped", message: "Sandbox terminated successfully" }, null, 2),
    }],
  };
}

function registerHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info({ tool: name }, "MCP tool called");
    try {
      switch (name) {
        case "run_sandbox": return await handleRunSandbox(args);
        case "get_sandbox_status": return await handleGetStatus(args);
        case "stop_sandbox": return await handleStopSandbox(args);
        default: throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error({ error, tool: name }, "MCP tool error");
      throw error;
    }
  });
}

async function startStdioServer(): Promise<void> {
  const server = new Server(
    { name: "locci-box-mcp", version: "1.1.0" },
    { capabilities: { tools: {} } },
  );
  registerHandlers(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info({ api: API_BASE }, "Locci Box MCP server started (stdio)");
}

async function startHttpServer(): Promise<void> {
  const port = env.MCP_HTTP_PORT;
  const app = express();
  app.use(express.json());

  // Stateless streamable HTTP transport — new Server+transport per request
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = new Server(
      { name: "locci-box-mcp", version: "1.1.0" },
      { capabilities: { tools: {} } },
    );
    registerHandlers(server);
    res.on("finish", () => server.close().catch(() => {}));
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // SSE stream for server-initiated notifications (stateless — just acknowledge)
  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "SSE not supported in stateless mode. Use POST /mcp." });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(200).json({ message: "Session closed" });
  });

  app.listen(port, () => {
    logger.info({ port, api: API_BASE }, `Locci Box MCP HTTP server started on :${port}`);
  });
}

if (env.MCP_ENABLED) {
  const tasks: Promise<void>[] = [startStdioServer()];
  if (env.MCP_HTTP_ENABLED) tasks.push(startHttpServer());

  Promise.all(tasks).catch((error) => {
    logger.error({ error }, "Failed to start MCP server");
    process.exit(1);
  });
}

// Made with Bob
