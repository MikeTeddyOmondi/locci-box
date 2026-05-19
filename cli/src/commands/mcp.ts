import { Command } from "commander";
import pc from "picocolors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getProfile } from "../lib/config.js";
import { printError, printInfo } from "../lib/output.js";

// ── MCP tool definitions (mirrors the API server) ────────────────────────────

const tools = [
  {
    name: "run_sandbox",
    description: "Execute code in an isolated microVM. Returns stdout, stderr, and exit code.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["python", "node", "bash", "ruby"], description: "Programming language" },
        code: { type: "string", description: "Code to execute" },
        timeout: { type: "number", description: "Max execution seconds (default 30)", default: 30 },
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
      },
      required: ["sandbox_id"],
    },
  },
];

async function apiRequest<T>(
  apiBase: string,
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
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

async function runMcpServer(apiUrl: string, apiKey: string): Promise<void> {
  const apiBase = apiUrl.replace(/\/$/, "");

  const server = new Server(
    { name: "locci-box-mcp", version: "1.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params as { name: string; arguments: any };
    switch (name) {
      case "run_sandbox": {
        const { language, code, timeout } = args;
        const result = await apiRequest(apiBase, apiKey, "/api/sandbox/run", {
          method: "POST",
          body: JSON.stringify({ language, code, timeout: timeout ?? 30 }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_sandbox_status": {
        const result = await apiRequest(apiBase, apiKey, `/api/sandbox/${args.sandbox_id}/status`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "stop_sandbox": {
        await apiRequest(apiBase, apiKey, `/api/sandbox/${args.sandbox_id}`, { method: "DELETE" });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ sandbox_id: args.sandbox_id, status: "stopped" }, null, 2),
          }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Config snippet helpers ────────────────────────────────────────────────────

function printClientConfig(apiUrl: string, apiKey: string): void {
  const npxConfig = {
    mcpServers: {
      "locci-box": {
        command: "npx",
        args: ["-y", "@locci/box", "mcp", "start"],
        env: { LOCCIBOX_API_URL: apiUrl, LOCCIBOX_API_KEY: apiKey },
      },
    },
  };

  const installedConfig = {
    mcpServers: {
      "locci-box": {
        command: "loccibox",
        args: ["mcp", "start"],
        env: { LOCCIBOX_API_URL: apiUrl, LOCCIBOX_API_KEY: apiKey },
      },
    },
  };

  console.log("\n" + pc.bold("MCP client config — add to your client's config file:\n"));
  console.log(pc.cyan("  ~/Library/Application Support/Claude/claude_desktop_config.json  (Claude Desktop / macOS)"));
  console.log(pc.cyan("  %APPDATA%\\Claude\\claude_desktop_config.json                      (Claude Desktop / Windows)"));
  console.log(pc.cyan("  ~/.config/cursor/mcp.json                                        (Cursor)\n"));

  console.log(pc.dim("# If loccibox is installed globally (npm i -g @locci/box):"));
  console.log(JSON.stringify(installedConfig, null, 2));

  console.log("\n" + pc.dim("# If not installed globally (uses npx):"));
  console.log(JSON.stringify(npxConfig, null, 2));
  console.log();
}

// ── Command definition ────────────────────────────────────────────────────────

export function createMcpCommand(): Command {
  const command = new Command("mcp");
  command.description("Manage the Locci Box MCP server");

  command
    .command("start")
    .description("Start the MCP server in stdio mode (for Claude Desktop / Cursor / other MCP clients)")
    .option("--api-url <url>", "Locci Box API URL (overrides profile)")
    .option("--api-key <key>", "API key (overrides profile)")
    .action(async (opts) => {
      const profile = getProfile();
      const apiUrl = opts.apiUrl ?? profile?.apiUrl ?? process.env.LOCCIBOX_API_URL;
      const apiKey = opts.apiKey ?? profile?.apiKey ?? process.env.LOCCIBOX_API_KEY;

      if (!apiUrl) {
        printError("No API URL. Pass --api-url or run 'loccibox init'.");
        process.exit(1);
      }
      if (!apiKey) {
        printError("No API key. Pass --api-key or run 'loccibox init'.");
        process.exit(1);
      }

      await runMcpServer(apiUrl, apiKey);
    });

  command
    .command("config")
    .description("Print the MCP client config JSON for Claude Desktop / Cursor / etc.")
    .option("--api-url <url>", "Locci Box API URL (overrides profile)")
    .option("--api-key <key>", "API key (overrides profile)")
    .action((opts) => {
      const profile = getProfile();
      const apiUrl = opts.apiUrl ?? profile?.apiUrl ?? process.env.LOCCIBOX_API_URL ?? "http://localhost:5757";
      const apiKey = opts.apiKey ?? profile?.apiKey ?? process.env.LOCCIBOX_API_KEY ?? "<your-api-key>";

      printInfo(`Using API: ${apiUrl}`);
      printClientConfig(apiUrl, apiKey);
    });

  return command;
}

// Made with Bob
