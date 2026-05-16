import { Router, Request, Response } from "express";
import { tenantService } from "../services/TenantService.js";
import { authenticateAdmin } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

/**
 * GET /metrics
 * Admin-only endpoint for system-wide metrics
 */
router.get(
  "/",
  authenticateAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get all tenants and their usage stats
      const allTenants = await tenantService.getAllTenants();
      const usageStats = await tenantService.getAllUsageStats();

      // Calculate system-wide metrics
      const totalSandboxesToday = allTenants.reduce(
        (sum, t) => sum + t.total_executions,
        0,
      );
      const activeSandboxes = allTenants.reduce(
        (sum, t) => sum + t.active_sandboxes,
        0,
      );

      // Calculate average execution time across all tenants
      const totalAvg = usageStats.reduce(
        (sum, s) => sum + s.avg_execution_ms,
        0,
      );
      const avgExecutionMs =
        usageStats.length > 0 ? Math.round(totalAvg / usageStats.length) : 0;

      res.json({
        success: true,
        data: {
          system: {
            total_tenants: allTenants.length,
            total_sandboxes_today: totalSandboxesToday,
            active_sandboxes: activeSandboxes,
            avg_execution_ms: avgExecutionMs,
          },
          tenants: usageStats,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error fetching metrics");
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

export default router;

// Made with Bob
