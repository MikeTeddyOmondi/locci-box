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
        language: { type: "string", enum: ["python", "node", "bash", "ruby", "go", "rust", "c", "cpp"], description: "Programming language" },
        code: { type: "string", description: "Code to execute. For go, rust, c and cpp, a complete program (package main with func main, fn main, int main)" },
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
        box_id: { type: "string", description: "Box id from box_create" },
        command: { type: "string", description: "Shell command" },
        timeout: { type: "number", description: "Seconds before the command is stopped (default 120, max 600)" },
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
        box_id: { type: "string", description: "Box id from box_create" },
        path: { type: "string", description: "File path, e.g. src/app.py" },
        content: { type: "string", description: "The whole file content" },
        encoding: { type: "string", enum: ["utf8", "base64"], description: "How content is encoded (default utf8)" },
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
        box_id: { type: "string", description: "Box id from box_create" },
        path: { type: "string", description: "File path" },
      },
      required: ["box_id", "path"],
    },
  },
  {
    name: "box_stop",
    description:
      "Stop a box. Its files and installed packages are kept and it can be started again. " +
      "remove: true deletes the box and its /workspace for good.",
    inputSchema: {
      type: "object",
      properties: {
        box_id: { type: "string", description: "Box id from box_create" },
        remove: { type: "boolean", description: "Delete the box and its files (default false)" },
      },
      required: ["box_id"],
    },
  },
  {
    name: "box_list",
    description: "List your boxes, running and stopped.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

const BOX_TOOLS = new Set(["box_create", "box_exec", "box_write_file", "box_read_file", "box_stop", "box_list"]);

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

/** The box_* tools, through the API's /api/boxes routes. */
async function boxTool(apiBase: string, apiKey: string, name: string, args: any): Promise<unknown> {
  const id = encodeURIComponent(String(args.box_id ?? ""));
  const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
  switch (name) {
    case "box_create":
      return apiRequest(apiBase, apiKey, "/api/boxes", post(args.box_id ? { box_id: args.box_id } : {}));
    case "box_exec":
      return apiRequest(apiBase, apiKey, `/api/boxes/${id}/exec`, post({ command: args.command, timeout: args.timeout }));
    case "box_write_file":
      return apiRequest(apiBase, apiKey, `/api/boxes/${id}/files`, {
        method: "PUT",
        body: JSON.stringify({ path: args.path, content: args.content, encoding: args.encoding }),
      });
    case "box_read_file":
      return apiRequest(apiBase, apiKey, `/api/boxes/${id}/files?path=${encodeURIComponent(String(args.path ?? ""))}`);
    case "box_stop":
      return args.remove === true
        ? apiRequest(apiBase, apiKey, `/api/boxes/${id}`, { method: "DELETE" })
        : apiRequest(apiBase, apiKey, `/api/boxes/${id}/stop`, { method: "POST" });
    default:
      return apiRequest(apiBase, apiKey, "/api/boxes");
  }
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
    if (BOX_TOOLS.has(name)) {
      // A box error (not found, limit reached) goes back as a tool error the model can act on.
      try {
        const result = await boxTool(apiBase, apiKey, name, args ?? {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
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
