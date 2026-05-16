import * as clack from "@clack/prompts";
import { setProfile, setDefaultProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import pc from "picocolors";

/**
 * Initialize Locci Box CLI configuration
 */
export async function initCommand(): Promise<void> {
  console.clear();

  clack.intro(pc.bgCyan(pc.black(" Locci Box Setup ")));

  // Get API base URL
  const apiUrl = await clack.text({
    message: "API base URL",
    placeholder: "http://localhost:5757",
    defaultValue: "http://localhost:5757",
    validate: (value) => {
      if (!value) return "API URL is required";
      if (!value.startsWith("http://") && !value.startsWith("https://")) {
        return "URL must start with http:// or https://";
      }
      return undefined;
    },
  });

  if (clack.isCancel(apiUrl)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  // Get API key
  const apiKey = await clack.password({
    message: "API key",
    validate: (value) => {
      if (!value) return "API key is required";
      if (value.length < 10) return "API key seems too short";
      return undefined;
    },
  });

  if (clack.isCancel(apiKey)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  // Test connection
  const s = clack.spinner();
  s.start("Testing connection...");

  try {
    const api = createAPIClient(apiUrl, apiKey);
    const connected = await api.testConnection();

    if (connected) {
      s.stop(pc.green("✓ Connected successfully"));
    } else {
      s.stop(
        pc.yellow("⚠ Could not verify connection, but config will be saved"),
      );
    }
  } catch (error) {
    s.stop(pc.yellow("⚠ Connection test failed, but config will be saved"));
  }

  // Get profile name
  const profileName = await clack.text({
    message: "Profile name",
    placeholder: "local",
    defaultValue: "local",
    validate: (value) => {
      if (!value) return "Profile name is required";
      if (!/^[a-z0-9-]+$/.test(value)) {
        return "Profile name must contain only lowercase letters, numbers, and hyphens";
      }
      return undefined;
    },
  });

  if (clack.isCancel(profileName)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  // Confirm default profile
  const setAsDefault = await clack.confirm({
    message: "Set this as your default profile?",
    initialValue: true,
  });

  if (clack.isCancel(setAsDefault)) {
    clack.cancel("Setup cancelled");
    process.exit(0);
  }

  // Save configuration
  try {
    setProfile(profileName, {
      apiUrl,
      apiKey,
    });

    if (setAsDefault) {
      setDefaultProfile(profileName);
    }

    clack.outro(
      pc.green("✓ Configuration saved!") +
        "\n\n" +
        pc.dim("  Run ") +
        pc.cyan("loccibox run --help") +
        pc.dim(" to get started."),
    );
  } catch (error) {
    clack.outro(pc.red(`✗ Failed to save configuration: ${error}`));
    process.exit(1);
  }
}

// Made with Bob
