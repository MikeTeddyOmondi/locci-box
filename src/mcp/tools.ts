import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { sandboxService } from "../services/SandboxService.js";
import { apiKeyService } from "../services/ApiKeyService.js";
import { tenantService } from "../services/TenantService.js";

const err = (text: string) => ({ isError: true, content: [{ type: "text" as const, text }] });

function resolveKey(argsKey?: string): string {
  const key = argsKey ?? process.env.LOCCIBOX_API_KEY ?? env.ADMIN_API_KEY;
  if (!key) throw new Error("No API key provided. Pass api_key in args or set LOCCIBOX_API_KEY.");
  return key;
}

async function resolveTenant(apiKey: string) {
  // Try admin key first
  const adminTenant = await tenantService.getByApiKey(apiKey);
  if (adminTenant) return adminTenant;

  // Try user API key
  const userKey = await apiKeyService.getByKey(apiKey);
  if (!userKey) throw new Error("Invalid API key");
  await apiKeyService.markUsed(userKey.id);

  const tenant = await tenantService.getById("tenant_default");
  if (!tenant) throw new Error("Default tenant not found");
  return tenant;
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
          const tenant = await resolveTenant(resolveKey(api_key));
          const canCreate = await tenantService.canCreateSandbox(tenant.id);
          if (!canCreate) return err("Sandbox limit reached for this tenant");
          await tenantService.incrementActive(tenant.id);
          try {
            const result = await sandboxService.execute(
              { language, code, timeout: timeout ?? 30 },
              tenant.id,
            );
            await tenantService.recordExecution(tenant.id, result.duration_ms, {
              sandboxId: result.sandbox_id,
              language,
              status: result.status as "completed" | "failed" | "timeout",
              exitCode: result.exit_code,
            });
            return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
          } finally {
            await tenantService.decrementActive(tenant.id);
          }
        }
        case "get_sandbox_status": {
          const { sandbox_id, api_key } = args as any;
          const tenant = await resolveTenant(resolveKey(api_key));
          const status = await sandboxService.getStatus(sandbox_id);
          if (!status) return err(`Sandbox ${sandbox_id} not found`);
          if (status.tenant_id !== tenant.id) return err("Access denied");
          return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
        }
        case "stop_sandbox": {
          const { sandbox_id, api_key } = args as any;
          const tenant = await resolveTenant(resolveKey(api_key));
          const status = await sandboxService.getStatus(sandbox_id);
          if (!status) return err(`Sandbox ${sandbox_id} not found`);
          if (status.tenant_id !== tenant.id) return err("Access denied");
          await sandboxService.stop(sandbox_id);
          await tenantService.decrementActive(tenant.id);
          return {
            content: [{
              type: "text" as const,
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
