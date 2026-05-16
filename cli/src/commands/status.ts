import { Command } from "commander";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import {
  printError,
  printMetadata,
  formatDuration,
  formatTimestamp,
} from "../lib/output.js";
import pc from "picocolors";

/**
 * Status command - Check sandbox status
 */
export function createStatusCommand(): Command {
  const command = new Command("status");

  command
    .description("Check the status of a sandbox")
    .argument("<sandbox-id>", "Sandbox ID to check")
    .option("--profile <name>", "Use a specific profile")
    .action(async (sandboxId: string, options: { profile?: string }) => {
      await statusCommand(sandboxId, options);
    });

  return command;
}

async function statusCommand(
  sandboxId: string,
  options: { profile?: string },
): Promise<void> {
  // Get profile
  const profile = getProfile(options.profile);
  if (!profile) {
    printError(
      "No configuration found. Run 'loccibox init' first or set LOCCIBOX_API_URL and LOCCIBOX_API_KEY environment variables.",
    );
    process.exit(1);
  }

  try {
    const api = createAPIClient(profile.apiUrl, profile.apiKey);
    const status = await api.getSandboxStatus(sandboxId);

    console.log("");
    console.log(pc.bold("Sandbox Status"));
    console.log("");

    const statusColor =
      status.status === "running"
        ? pc.green
        : status.status === "completed"
          ? pc.blue
          : status.status === "failed"
            ? pc.red
            : pc.yellow;

    printMetadata({
      "Sandbox ID": pc.cyan(status.sandbox_id),
      Status: statusColor(status.status),
      Language: status.language,
      Uptime: status.uptime_ms ? formatDuration(status.uptime_ms) : "N/A",
      Created: formatTimestamp(status.created_at),
      "Tenant ID": pc.dim(status.tenant_id),
    });

    console.log("");
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Made with Bob
