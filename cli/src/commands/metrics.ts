import { Command } from "commander";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import {
  printError,
  printTable,
  formatDuration,
  formatTimestamp,
} from "../lib/output.js";
import pc from "picocolors";

/**
 * Metrics command - View usage statistics
 */
export function createMetricsCommand(): Command {
  const command = new Command("metrics");

  command
    .description("View usage statistics and metrics")
    .option("--profile <name>", "Use a specific profile")
    .action(async (options: { profile?: string }) => {
      await metricsCommand(options);
    });

  return command;
}

async function metricsCommand(options: { profile?: string }): Promise<void> {
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
    const metrics = await api.getMetrics();

    // Display system metrics
    console.log("");
    console.log(pc.bold("System Metrics"));
    console.log("");
    console.log(
      pc.dim("  Total Tenants       ") + metrics.system.total_tenants,
    );
    console.log(
      pc.dim("  Sandboxes Today     ") + metrics.system.total_sandboxes_today,
    );
    console.log(
      pc.dim("  Active Sandboxes    ") + metrics.system.active_sandboxes,
    );
    console.log(
      pc.dim("  Avg Execution Time  ") +
        formatDuration(metrics.system.avg_execution_ms),
    );

    // Display tenant metrics
    if (metrics.tenants.length > 0) {
      console.log("");
      console.log(pc.bold("Tenant Usage"));

      const tableData = metrics.tenants.map((tenant) => ({
        organization: tenant.organization,
        total_runs: tenant.total_runs.toString(),
        active: tenant.active_sandboxes.toString(),
        avg_time: formatDuration(tenant.avg_execution_ms),
        last_activity: formatTimestamp(tenant.last_activity),
      }));

      printTable(tableData, [
        { key: "organization", label: "ORGANIZATION", width: 25 },
        { key: "total_runs", label: "TOTAL RUNS", width: 12 },
        { key: "active", label: "ACTIVE", width: 8 },
        { key: "avg_time", label: "AVG TIME", width: 12 },
        { key: "last_activity", label: "LAST ACTIVITY", width: 20 },
      ]);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// Made with Bob
