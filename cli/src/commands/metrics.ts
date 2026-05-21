import { Command } from "commander";
import { getProfile } from "../lib/config.js";
import { createAPIClient } from "../lib/api.js";
import type { StatsData } from "../types/index.js";
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

  const api = createAPIClient(profile.apiUrl, profile.apiKey);

  try {
    // Admin path — full system-wide metrics
    const metrics = await api.getMetrics();

    console.log("");
    console.log(pc.bold("System Metrics"));
    console.log("");
    console.log(pc.dim("  Total Tenants       ") + metrics.system.total_tenants);
    console.log(pc.dim("  Sandboxes Today     ") + metrics.system.total_sandboxes_today);
    console.log(pc.dim("  Active Sandboxes    ") + metrics.system.active_sandboxes);
    console.log(pc.dim("  Avg Execution Time  ") + formatDuration(metrics.system.avg_execution_ms));

    if (metrics.tenants.length > 0) {
      console.log("");
      console.log(pc.bold("Tenant Usage"));
      printTable(
        metrics.tenants.map((t) => ({
          organization: t.organization,
          total_runs: t.total_runs.toString(),
          active: t.active_sandboxes.toString(),
          avg_time: formatDuration(t.avg_execution_ms),
          last_activity: formatTimestamp(t.last_activity),
        })),
        [
          { key: "organization", label: "ORGANIZATION", width: 25 },
          { key: "total_runs", label: "TOTAL RUNS", width: 12 },
          { key: "active", label: "ACTIVE", width: 8 },
          { key: "avg_time", label: "AVG TIME", width: 12 },
          { key: "last_activity", label: "LAST ACTIVITY", width: 20 },
        ],
      );
    }
  } catch (adminError) {
    const msg = adminError instanceof Error ? adminError.message : "";
    if (!msg.toLowerCase().includes("forbidden") && !msg.toLowerCase().includes("authentication")) {
      printError(msg || "Unknown error");
      process.exit(1);
    }

    // Not an admin — fall back to per-tenant stats via JWT
    if (!profile.jwtToken) {
      printError("Run 'loccibox login' first to view your usage stats.");
      process.exit(1);
    }

    try {
      const stats: StatsData = await api.getStats(profile.jwtToken);
      const successRate = stats.total_runs > 0
        ? Math.round((stats.success_runs / stats.total_runs) * 100)
        : 0;

      console.log("");
      console.log(pc.bold(`Usage — ${stats.organization}`));
      console.log("");
      console.log(pc.dim("  Total Runs          ") + stats.total_runs);
      console.log(pc.dim("  Success Rate        ") + `${successRate}%`);
      console.log(pc.dim("  Active Sandboxes    ") + stats.active_sandboxes);
      console.log(pc.dim("  Avg Execution Time  ") + formatDuration(stats.avg_execution_ms));
      console.log(pc.dim("  Last Activity       ") + formatTimestamp(stats.last_activity));

      if (stats.recent_runs.length > 0) {
        console.log("");
        console.log(pc.bold("Recent Runs"));
        printTable(
          stats.recent_runs.slice(0, 10).map((r) => ({
            id: r.sandbox_id.slice(0, 12),
            language: r.language,
            status: r.status,
            duration: formatDuration(r.duration_ms),
            started: formatTimestamp(r.created_at),
          })),
          [
            { key: "id", label: "SANDBOX ID", width: 14 },
            { key: "language", label: "LANGUAGE", width: 10 },
            { key: "status", label: "STATUS", width: 10 },
            { key: "duration", label: "DURATION", width: 10 },
            { key: "started", label: "STARTED", width: 20 },
          ],
        );
      }
    } catch (statsError) {
      printError(statsError instanceof Error ? statsError.message : "Unknown error");
      process.exit(1);
    }
  }
}

// Made with Bob
