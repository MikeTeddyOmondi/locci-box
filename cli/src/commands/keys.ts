import { Command } from "commander";
import { printWarning } from "../lib/output.js";

/**
 * Keys command - Manage API keys (future implementation)
 */
export function createKeysCommand(): Command {
  const command = new Command("keys");

  command.description("Manage API keys (coming soon)");

  // List keys
  command
    .command("list")
    .description("List all API keys")
    .action(() => {
      printWarning("API key management is not yet implemented in the backend.");
      printWarning("This feature will be available in a future release.");
    });

  // Create key
  command
    .command("create")
    .description("Create a new API key")
    .option("-n, --name <name>", "Name for the API key")
    .action(() => {
      printWarning("API key management is not yet implemented in the backend.");
      printWarning("This feature will be available in a future release.");
    });

  // Revoke key
  command
    .command("revoke")
    .description("Revoke an API key")
    .argument("<key-id>", "API key ID to revoke")
    .action(() => {
      printWarning("API key management is not yet implemented in the backend.");
      printWarning("This feature will be available in a future release.");
    });

  return command;
}

// Made with Bob
