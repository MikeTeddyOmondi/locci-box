#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { createLoginCommand } from "./commands/login.js";
import { createRunCommand } from "./commands/run.js";
import { createStatusCommand } from "./commands/status.js";
import { createStopCommand } from "./commands/stop.js";
import { createMetricsCommand } from "./commands/metrics.js";
import { createKeysCommand } from "./commands/keys.js";
import { createMcpCommand } from "./commands/mcp.js";
import { configExists } from "./lib/config.js";
import { printWarning } from "./lib/output.js";

const program = new Command();

program
  .name("loccibox")
  .description("CLI for Locci Box - Execute code in isolated sandboxes")
  .version("1.1.0");

// Init command (special - doesn't require config)
program
  .command("init")
  .description("Initialize Locci Box CLI configuration")
  .action(initCommand);

// Add other commands
program.addCommand(createLoginCommand());
program.addCommand(createRunCommand());
program.addCommand(createStatusCommand());
program.addCommand(createStopCommand());
program.addCommand(createMetricsCommand());
program.addCommand(createKeysCommand());
program.addCommand(createMcpCommand());

// Show warning if config doesn't exist and command is not init
const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== "init" && args[0] !== "login" && args[0] !== "mcp" && !configExists()) {
  const hasEnvVars =
    process.env.LOCCIBOX_API_URL && process.env.LOCCIBOX_API_KEY;

  if (!hasEnvVars) {
    printWarning(
      "No configuration found. Run 'loccibox init' to set up your CLI.",
    );
    console.log("");
  }
}

// Parse arguments
program.parse();

// Made with Bob
