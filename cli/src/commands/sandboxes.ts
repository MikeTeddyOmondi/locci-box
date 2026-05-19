import { Command } from "commander";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import { printError, printTable, formatDuration, formatTimestamp } from "../lib/output.js";
import pc from "picocolors";

export function createSandboxesCommand(): Command {
  const command = new Command("sandboxes");

  command
    .description("List all active sandboxes")
    .option("--profile <name>", "Use a specific profile")
    .action(async (options: { profile?: string }) => {
      await sandboxesCommand(options);
    });

  return command;
}

async function sandboxesCommand(options: { profile?: string }): Promise<void> {
  const profile = getProfile(options.profile);
  if (!profile) {
    printError(
      "No configuration found. Run 'loccibox init' first or set LOCCIBOX_API_URL and LOCCIBOX_API_KEY environment variables.",
    );
    process.exit(1);
  }

  try {
    const api = createAPIClient(profile.apiUrl, profile.apiKey);
    const sandboxes = await api.listSandboxes();

    if (sandboxes.length === 0) {
      console.log("");
      console.log(pc.dim("  No active sandboxes."));
      console.log("");
      return;
    }

    console.log("");
    console.log(pc.bold(`Active Sandboxes (${sandboxes.length})`));

    const tableData = sandboxes.map((s) => ({
      id: s.sandbox_id,
      language: s.language,
      status: s.status === "running" ? pc.green(s.status) : pc.yellow(s.status),
      uptime: s.uptime_ms != null ? formatDuration(s.uptime_ms) : "—",
      started: formatTimestamp(s.created_at),
    }));

    printTable(tableData, [
      { key: "id", label: "SANDBOX ID", width: 22 },
      { key: "language", label: "LANG", width: 8 },
      { key: "status", label: "STATUS", width: 10 },
      { key: "uptime", label: "UPTIME", width: 12 },
      { key: "started", label: "STARTED", width: 20 },
    ]);
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Made with Bob
