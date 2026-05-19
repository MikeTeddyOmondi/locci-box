import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

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

function resolveKey(argsKey?: string): string {
  const key = argsKey ?? process.env.LOCCIBOX_API_KEY ?? env.ADMIN_API_KEY;
  if (!key) throw new Error("No API key provided. Pass api_key in args or set LOCCIBOX_API_KEY.");
  return key;
}

export const tools = [
  {
    name: "run_sandbox",
    description: "Execute code in an isolated microVM. Returns stdout, stderr, and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["python", "node", "bash", "ruby"], description: "Programming language" },
        code: { type: "string", description: "Code to execute in the sandbox" },
        timeout: { type: "number", description: "Maximum execution time in seconds (default: 30)" },
        api_key: { type: "string", description: "API key (falls back to LOCCIBOX_API_KEY env var)" },
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
        sandbox_id: { type: "string", description: "Sandbox ID to check" },
        api_key: { type: "string", description: "API key (falls back to LOCCIBOX_API_KEY env var)" },
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
        sandbox_id: { type: "string", description: "Sandbox ID to stop" },
        api_key: { type: "string", description: "API key (falls back to LOCCIBOX_API_KEY env var)" },
      },
      required: ["sandbox_id"],
    },
  },
];

export function createMCPServer(): Server {
  // Server is the low-level API; McpServer.registerTool requires Zod which is not a project dep.
  const server = new Server(
    { name: "locci-box-mcp", version: "1.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info({ tool: name }, "MCP tool called");
    try {
      switch (name) {
        case "run_sandbox": {
          const { language, code, timeout, api_key } = args as any;
          const result = await apiRequest("/api/sandbox/run", resolveKey(api_key), {
            method: "POST",
            body: JSON.stringify({ language, code, timeout: timeout ?? 30 }),
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "get_sandbox_status": {
          const { sandbox_id, api_key } = args as any;
          const result = await apiRequest(`/api/sandbox/${sandbox_id}/status`, resolveKey(api_key));
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        case "stop_sandbox": {
          const { sandbox_id, api_key } = args as any;
          await apiRequest(`/api/sandbox/${sandbox_id}`, resolveKey(api_key), { method: "DELETE" });
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ sandbox_id, status: "stopped", message: "Sandbox terminated successfully" }, null, 2),
            }],
          };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error({ error, tool: name }, "MCP tool error");
      throw error;
    }
  });

  return server;
}

// Made with Bob
