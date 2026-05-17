import { Router, Request, Response } from "express";
import { tenantService } from "../services/TenantService.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

/**
 * GET /api/stats
 * Returns real usage stats for the authenticated tenant.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const [stats, recentRuns, successRuns, dailyRuns] = await Promise.all([
      tenantService.getUsageStats(tenantId),
      tenantService.getRecentRuns(tenantId, 20),
      tenantService.getSuccessRuns(tenantId),
      tenantService.getDailyRuns(tenantId, 7),
    ]);

    if (!stats) {
      res.status(404).json({ success: false, error: "Tenant not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        ...stats,
        success_runs: successRuns,
        recent_runs: recentRuns,
        daily_runs: dailyRuns,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching stats");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
