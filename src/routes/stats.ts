import { Router, Request, Response } from "express";
import { tenantService } from "../services/TenantService.js";
import { sandboxService } from "../services/SandboxService.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

/**
 * GET /api/stats
 * Returns real usage stats for the authenticated tenant.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const [stats, recentRuns, successRuns, dailyRuns, liveSandboxes] = await Promise.all([
      tenantService.getUsageStats(tenantId),
      tenantService.getRecentRuns(tenantId, 20),
      tenantService.getSuccessRuns(tenantId),
      tenantService.getDailyRuns(tenantId, 7),
      sandboxService.listActive(tenantId),
    ]);

    if (!stats) {
      res.status(404).json({ success: false, error: "Tenant not found" });
      return;
    }

    // Prepend still-running sandboxes so they appear in recent activity immediately
    const liveAsRuns = liveSandboxes.map((s) => ({
      sandbox_id: s.sandbox_id,
      language: s.language,
      status: "running" as const,
      exit_code: null,
      duration_ms: s.uptime_ms ?? null,
      created_at: s.created_at,
    }));
    const liveIds = new Set(liveAsRuns.map((s) => s.sandbox_id));
    const mergedRuns = [
      ...liveAsRuns,
      ...recentRuns.filter((r) => !liveIds.has(r.sandbox_id)),
    ].slice(0, 20);

    res.json({
      success: true,
      data: {
        ...stats,
        success_runs: successRuns,
        recent_runs: mergedRuns,
        daily_runs: dailyRuns,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error fetching stats");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
