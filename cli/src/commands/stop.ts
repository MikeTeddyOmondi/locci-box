import { Command } from "commander";
import * as clack from "@clack/prompts";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import { printError, printSuccess } from "../lib/output.js";
import pc from "picocolors";

/**
 * Stop command - Stop and destroy a sandbox
 */
export function createStopCommand(): Command {
  const command = new Command("stop");

  command
    .description("Stop and destroy a running sandbox")
    .argument("<sandbox-id>", "Sandbox ID to stop")
    .option("--profile <name>", "Use a specific profile")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      async (
        sandboxId: string,
        options: { profile?: string; yes?: boolean },
      ) => {
        await stopCommand(sandboxId, options);
      },
    );

  return command;
}

async function stopCommand(
  sandboxId: string,
  options: { profile?: string; yes?: boolean },
): Promise<void> {
  // Get profile
  const profile = getProfile(options.profile);
  if (!profile) {
    printError(
      "No configuration found. Run 'loccibox init' first or set LOCCIBOX_API_URL and LOCCIBOX_API_KEY environment variables.",
    );
    process.exit(1);
  }

  // Confirm unless --yes flag is provided
  if (!options.yes) {
    const confirmed = await clack.confirm({
      message: `Stop sandbox ${pc.cyan(sandboxId)}?`,
      initialValue: false,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }
  }

  // Stop sandbox
  const s = clack.spinner();
  s.start("Stopping sandbox...");

  try {
    const api = createAPIClient(profile.apiUrl, profile.apiKey);
    await api.stopSandbox(sandboxId);

    s.stop(pc.green("✓ Sandbox stopped"));
    printSuccess(`Sandbox ${sandboxId} has been terminated.`);
  } catch (error) {
    s.stop(pc.red("✗ Failed to stop sandbox"));
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Made with Bob
