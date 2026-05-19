import { Command } from "commander";
import * as clack from "@clack/prompts";
import { getProfile, loadConfig, saveConfig } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import pc from "picocolors";

export function createLoginCommand(): Command {
  const command = new Command("login");

  command
    .description("Authenticate with your Locci Box account to manage API keys")
    .option("--profile <name>", "Profile to authenticate against")
    .action(async (opts) => {
      clack.intro(pc.bgCyan(pc.black(" Locci Box Login ")));

      const profile = getProfile(opts.profile);
      if (!profile) {
        clack.outro(pc.red("✗ No profile found. Run 'loccibox init' first."));
        process.exit(1);
      }

      const email = await clack.text({
        message: "Email",
        validate: (v) => (!v ? "Email is required" : undefined),
      });
      if (clack.isCancel(email)) {
        clack.cancel("Cancelled");
        process.exit(0);
      }

      const password = await clack.password({
        message: "Password",
        validate: (v) => (!v ? "Password is required" : undefined),
      });
      if (clack.isCancel(password)) {
        clack.cancel("Cancelled");
        process.exit(0);
      }

      const s = clack.spinner();
      s.start("Signing in…");

      try {
        const api = createAPIClient(profile.apiUrl, profile.apiKey);
        const result = await api.login(email, password);

        const config = loadConfig();
        const profileName = opts.profile || config.default;
        if (config.profiles[profileName]) {
          config.profiles[profileName].jwtToken = result.token;
          saveConfig(config);
        }

        s.stop(pc.green("✓ Authenticated"));
        clack.outro(
          pc.green(`Logged in as ${result.user.email}`) +
            "\n\n" +
            pc.dim("  Run ") +
            pc.cyan("loccibox keys list") +
            pc.dim(" to manage your API keys."),
        );
      } catch (error) {
        s.stop(pc.red("✗ Login failed"));
        clack.outro(
          pc.red(`✗ ${error instanceof Error ? error.message : "Login failed"}`),
        );
        process.exit(1);
      }
    });

  return command;
}

// Made with Bob
