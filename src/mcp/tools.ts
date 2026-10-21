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
import { boxService, BoxError, type BoxOwner } from "../services/BoxService.js";
import { SUPPORTED_LANGUAGES } from "../types/index.js";

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

/**
 * The tenant and the owner of boxes for a key: the user behind a user API key
 * (all of which map to tenant_default), or the tenant itself for a tenant key.
 */
async function resolveOwner(apiKey: string): Promise<BoxOwner> {
  const tenant = await tenantService.getByApiKey(apiKey);
  if (tenant) return { tenantId: tenant.id, ownerId: tenant.id };
  const userKey = await apiKeyService.getByKey(apiKey);
  if (!userKey || userKey.status !== "active") throw new Error("Invalid API key");
  await apiKeyService.markUsed(userKey.id);
  return { tenantId: "tenant_default", ownerId: userKey.userId };
}

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

const apiKeyProp = { type: "string", description: "API key (falls back to LOCCIBOX_API_KEY env var)" };
const boxIdProp = { type: "string", description: "Box id from box_create" };

export const tools = [
  {
    name: "run_sandbox",
    description: "Execute code in an isolated microVM. Returns stdout, stderr, and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: [...SUPPORTED_LANGUAGES], description: "Programming language" },
        code: { type: "string", description: "Code to execute. For go, rust, c and cpp, a complete program (package main with func main, fn main, int main)" },
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
  {
    name: "list_sandboxes",
    description: "List all currently running sandboxes for the tenant. Use this to recover sandbox IDs when a previous run_sandbox response was lost.",
    inputSchema: {
      type: "object",
      properties: {
        api_key: { type: "string", description: "API key (falls back to LOCCIBOX_API_KEY env var)" },
      },
      required: [],
    },
  },
  {
    name: "box_create",
    description:
      "Create an agent box: a Debian microVM (apt, git, curl, build tools, Python, Node) that keeps running between calls, " +
      "with internet access (the host's networks are blocked). Work happens in /workspace. Pass box_id to reattach to a box " +
      "you created before: a box stopped after idling starts again with its files and installed packages. Store the id.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: { type: "string", description: "Reattach to this box instead of creating one" },
        api_key: apiKeyProp,
      },
      required: [],
    },
  },
  {
    name: "box_exec",
    description:
      "Run a shell command in a box (sh -c, in /workspace). State is kept between calls: files, installed packages, " +
      "but not the shell's cwd or variables. Returns exit_code, stdout and stderr. Starts the box if it was stopped.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: boxIdProp,
        command: { type: "string", description: "Shell command, e.g. \"apt-get install -y jq && jq --version\"" },
        timeout: { type: "number", description: "Seconds before the command is stopped (default 120, max 600)" },
        api_key: apiKeyProp,
      },
      required: ["box_id", "command"],
    },
  },
  {
    name: "box_write_file",
    description: "Write a file in a box (parent folders are created). Relative paths are under /workspace.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: boxIdProp,
        path: { type: "string", description: "File path, e.g. src/app.py" },
        content: { type: "string", description: "The whole file content" },
        encoding: { type: "string", enum: ["utf8", "base64"], description: "How content is encoded (default utf8)" },
        api_key: apiKeyProp,
      },
      required: ["box_id", "path", "content"],
    },
  },
  {
    name: "box_read_file",
    description: "Read a file from a box (up to 1 MB; binary files come back as base64). Relative paths are under /workspace.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: boxIdProp,
        path: { type: "string", description: "File path" },
        api_key: apiKeyProp,
      },
      required: ["box_id", "path"],
    },
  },
  {
    name: "box_stop",
    description:
      "Stop a box. Its files and installed packages are kept and it can be started again (box_create with box_id, " +
      "or any box call). remove: true deletes the box and its /workspace for good.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: boxIdProp,
        remove: { type: "boolean", description: "Delete the box and its files (default false)" },
        api_key: apiKeyProp,
      },
      required: ["box_id"],
    },
  },
  {
    name: "box_list",
    description: "List your boxes, running and stopped.",
    inputSchema: {
      type: "object",
      properties: { api_key: apiKeyProp },
      required: [],
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
          if (sandboxService.imagePending(language)) {
            return err(`The ${language} runtime is still downloading on this host; retry in a minute`);
          }
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
        case "list_sandboxes": {
          const { api_key } = args as any;
          const tenant = await resolveTenant(resolveKey(api_key));
          const sandboxes = await sandboxService.listActive(tenant.id);
          if (sandboxes.length === 0) {
            return { content: [{ type: "text" as const, text: "No active sandboxes." }] };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(sandboxes, null, 2) }] };
        }
        case "box_create": {
          const { box_id, api_key } = args as any;
          return json(await boxService.create(await resolveOwner(resolveKey(api_key)), box_id));
        }
        case "box_exec": {
          const { box_id, command, timeout, api_key } = args as any;
          return json(await boxService.exec(await resolveOwner(resolveKey(api_key)), box_id, command, timeout));
        }
        case "box_write_file": {
          const { box_id, path, content, encoding, api_key } = args as any;
          return json(await boxService.writeFile(await resolveOwner(resolveKey(api_key)), box_id, path, content, encoding));
        }
        case "box_read_file": {
          const { box_id, path, api_key } = args as any;
          return json(await boxService.readFile(await resolveOwner(resolveKey(api_key)), box_id, path));
        }
        case "box_stop": {
          const { box_id, remove, api_key } = args as any;
          const box = await boxService.stop(await resolveOwner(resolveKey(api_key)), box_id, remove === true);
          return json(box ?? { box_id, status: "removed" });
        }
        case "box_list": {
          const { api_key } = args as any;
          return json(await boxService.list(await resolveOwner(resolveKey(api_key))));
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // A box problem the model can act on (not found, limit reached): say so as a tool error.
      if (error instanceof BoxError) return err(error.message);
      logger.error({ error, tool: name }, "MCP tool error");
      throw error;
    }
  });

  return server;
}

// Made with Bob
