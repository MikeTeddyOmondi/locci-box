import { Command } from "commander";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import pc from "picocolors";
import { getProfile } from "../lib/config.js";
import { printError, printInfo } from "../lib/output.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the MCP server entry point relative to this CLI binary
function resolveMcpServerPath(): string {
  // When installed, dist/commands/mcp.js → dist/mcp/server.js
  return path.resolve(__dirname, "../mcp/server.js");
}

function printClientConfig(serverPath: string, apiUrl: string, apiKey: string): void {
  const config = {
    mcpServers: {
      "locci-box": {
        command: "node",
        args: [serverPath],
        env: {
          MCP_ENABLED: "true",
          LOCCIBOX_API_URL: apiUrl,
          LOCCIBOX_API_KEY: apiKey,
        },
      },
    },
  };

  console.log("\n" + pc.bold("MCP client config (Claude Desktop / Cursor / etc.):\n"));
  console.log(pc.cyan("  ~/Library/Application Support/Claude/claude_desktop_config.json"));
  console.log(pc.cyan("  %APPDATA%\\Claude\\claude_desktop_config.json  (Windows)"));
  console.log(pc.cyan("  ~/.config/cursor/mcp.json                    (Cursor)\n"));
  console.log(JSON.stringify(config, null, 2));
  console.log();
}

export function createMcpCommand(): Command {
  const command = new Command("mcp");
  command.description("Manage the Locci Box MCP server");

  // start subcommand
  command
    .command("start")
    .description("Start the MCP server (stdio transport for MCP clients)")
    .option("--api-url <url>", "Locci Box API URL (overrides profile)")
    .option("--api-key <key>", "API key (overrides profile)")
    .action((opts) => {
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

      const serverPath = resolveMcpServerPath();

      const child = spawn("node", [serverPath], {
        stdio: "inherit",
        env: {
          ...process.env,
          MCP_ENABLED: "true",
          LOCCIBOX_API_URL: apiUrl,
          LOCCIBOX_API_KEY: apiKey,
        },
      });

      child.on("error", (err) => {
        printError(`Failed to start MCP server: ${err.message}`);
        process.exit(1);
      });

      child.on("exit", (code) => {
        process.exit(code ?? 0);
      });
    });

  // config subcommand — print the JSON snippet for MCP clients
  command
    .command("config")
    .description("Print the MCP client config JSON for Claude Desktop / Cursor / etc.")
    .option("--api-url <url>", "Locci Box API URL (overrides profile)")
    .option("--api-key <key>", "API key (overrides profile)")
    .action((opts) => {
      const profile = getProfile();
      const apiUrl = opts.apiUrl ?? profile?.apiUrl ?? process.env.LOCCIBOX_API_URL ?? "http://localhost:5757";
      const apiKey = opts.apiKey ?? profile?.apiKey ?? process.env.LOCCIBOX_API_KEY ?? "<your-api-key>";

      const serverPath = resolveMcpServerPath();

      printInfo(`MCP server path: ${serverPath}`);
      printClientConfig(serverPath, apiUrl, apiKey);
    });

  return command;
}

// Made with Bob
