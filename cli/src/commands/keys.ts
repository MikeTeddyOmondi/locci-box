import { Command } from "commander";
import pc from "picocolors";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import {
  printError,
  printSuccess,
  printInfo,
  printTable,
  printBox,
  formatTimestamp,
} from "../lib/output.js";

function authOrExit(profileName?: string) {
  const profile = getProfile(profileName);
  if (!profile) {
    printError("No configuration found. Run 'loccibox init' to set up the CLI.");
    return null;
  }
  if (!profile.jwtToken) {
    printError("Not logged in. Run 'loccibox login' to authenticate.");
    return null;
  }
  return { api: createAPIClient(profile.apiUrl, profile.apiKey), jwt: profile.jwtToken };
}

function handleAuthError(err: unknown): void {
  const msg = err instanceof Error ? err.message : "Request failed";
  if (msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("forbidden")) {
    printError("Session expired or invalid. Run 'loccibox login' to re-authenticate.");
  } else {
    printError(msg);
  }
}

export function createKeysCommand(): Command {
  const command = new Command("keys");
  command.description("Manage your API keys");

  // list
  command
    .command("list")
    .description("List all your API keys")
    .option("--profile <name>", "Use a specific profile")
    .action(async (opts) => {
      const auth = authOrExit(opts.profile);
      if (!auth) return;
      try {
        const keys = await auth.api.listKeys(auth.jwt);
        if (keys.length === 0) {
          printInfo("No API keys yet. Create one with: loccibox keys create --name <name>");
          return;
        }
        printTable(
          keys.map((k) => ({
            id: k.id,
            name: k.name,
            key: k.key,
            status: k.status === "active" ? pc.green("active") : pc.dim("revoked"),
            created: formatTimestamp(k.createdAt),
            lastUsed: k.lastUsedAt ? formatTimestamp(k.lastUsedAt) : pc.dim("never"),
          })),
          [
            { key: "id", label: "ID", width: 18 },
            { key: "name", label: "Name", width: 20 },
            { key: "key", label: "Key (masked)", width: 22 },
            { key: "status", label: "Status", width: 10 },
            { key: "created", label: "Created", width: 16 },
            { key: "lastUsed", label: "Last Used", width: 16 },
          ],
        );
      } catch (err) {
        handleAuthError(err);
      }
    });

  // create
  command
    .command("create")
    .description("Create a new API key")
    .requiredOption("-n, --name <name>", "Name for the new key")
    .option("--profile <name>", "Use a specific profile")
    .action(async (opts) => {
      const auth = authOrExit(opts.profile);
      if (!auth) return;
      try {
        const key = await auth.api.createKey(opts.name, auth.jwt);
        printSuccess(`Created key: ${pc.bold(opts.name)}`);
        printBox("API Key — copy it now, it won't be shown again", key.key, "green");
        printInfo(`Key ID: ${key.id}`);
      } catch (err) {
        handleAuthError(err);
      }
    });

  // revoke
  command
    .command("revoke")
    .description("Revoke an API key (marks it inactive, keeps history)")
    .argument("<key-id>", "ID of the key to revoke")
    .option("--profile <name>", "Use a specific profile")
    .action(async (keyId, opts) => {
      const auth = authOrExit(opts.profile);
      if (!auth) return;
      try {
        await auth.api.revokeKey(keyId, auth.jwt);
        printSuccess(`Key ${pc.bold(keyId)} revoked.`);
      } catch (err) {
        handleAuthError(err);
      }
    });

  // delete
  command
    .command("delete")
    .description("Permanently delete an API key")
    .argument("<key-id>", "ID of the key to delete")
    .option("--profile <name>", "Use a specific profile")
    .action(async (keyId, opts) => {
      const auth = authOrExit(opts.profile);
      if (!auth) return;
      try {
        await auth.api.deleteKey(keyId, auth.jwt);
        printSuccess(`Key ${pc.bold(keyId)} deleted.`);
      } catch (err) {
        handleAuthError(err);
      }
    });

  return command;
}

// Made with Bob
