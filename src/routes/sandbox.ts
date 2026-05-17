import { Router, Request, Response } from "express";
import { sandboxService } from "../services/SandboxService.js";
import { tenantService } from "../services/TenantService.js";
import { RunSandboxRequest, SupportedLanguage } from "../types/index.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

/**
 * POST /sandbox/run
 * Execute code in an isolated microVM
 */
router.post("/run", async (req: Request, res: Response): Promise<void> => {
  try {
    const tenant = (req as any).tenant;
    const tenantId = tenant.id;

    // Validate request body
    const { language, code, timeout }: RunSandboxRequest = req.body;

    if (!language || !code) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: language and code",
      });
      return;
    }

    // Validate language
    const validLanguages: SupportedLanguage[] = [
      "python",
      "node",
      "bash",
      "ruby",
    ];
    if (!validLanguages.includes(language)) {
      res.status(400).json({
        success: false,
        error: `Invalid language. Supported: ${validLanguages.join(", ")}`,
      });
      return;
    }

    // Validate code size (max 1MB)
    if (code.length > 1024 * 1024) {
      res.status(400).json({
        success: false,
        error: "Code size exceeds 1MB limit",
      });
      return;
    }

    // Validate timeout
    const maxTimeout = tenant.max_execution_time_seconds;
    const requestTimeout = timeout || 30;
    if (requestTimeout > maxTimeout) {
      res.status(400).json({
        success: false,
        error: `Timeout exceeds maximum allowed: ${maxTimeout} seconds`,
      });
      return;
    }

    // Check if tenant can create new sandbox
    const canCreate = await tenantService.canCreateSandbox(tenantId);
    if (!canCreate) {
      res.status(503).json({
        success: false,
        error: "Maximum concurrent sandboxes reached",
        max_concurrent: tenant.max_concurrent_sandboxes,
      });
      return;
    }

    // Increment active sandbox count
    await tenantService.incrementActive(tenantId);

    try {
      // Execute code in sandbox
      const result = await sandboxService.execute(
        {
          language,
          code,
          timeout: requestTimeout,
        },
        tenantId,
      );

      // Record execution metrics
      await tenantService.recordExecution(tenantId, result.duration_ms, {
        sandboxId: result.sandbox_id,
        language,
        status: result.status as "completed" | "failed" | "timeout",
        exitCode: result.exit_code,
      });

      // Decrement active sandbox count
      await tenantService.decrementActive(tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      // Ensure we decrement on error
      await tenantService.decrementActive(tenantId);
      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Error executing sandbox");
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * GET /sandbox/:id/status
 * Check sandbox execution status
 */
router.get(
  "/:id/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sandboxId = req.params.id;
      const tenant = (req as any).tenant;

      const status = await sandboxService.getStatus(sandboxId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: "Sandbox not found or already completed",
        });
        return;
      }

      // Verify tenant owns this sandbox
      if (status.tenant_id !== tenant.id) {
        res.status(403).json({
          success: false,
          error: "Forbidden",
        });
        return;
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error(
        { error, sandbox_id: req.params.id },
        "Error getting sandbox status",
      );
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * DELETE /sandbox/:id
 * Stop and destroy a running sandbox
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const sandboxId = req.params.id;
    const tenant = (req as any).tenant;
    const tenantId = tenant.id;

    // Get sandbox status first to verify ownership
    const status = await sandboxService.getStatus(sandboxId);

    if (!status) {
      res.status(404).json({
        success: false,
        error: "Sandbox not found or already stopped",
      });
      return;
    }

    // Verify tenant owns this sandbox
    if (status.tenant_id !== tenantId) {
      res.status(403).json({
        success: false,
        error: "Forbidden",
      });
      return;
    }

    // Stop the sandbox
    await sandboxService.stop(sandboxId);

    // Decrement active sandbox count
    await tenantService.decrementActive(tenantId);

    res.json({
      success: true,
      data: {
        sandbox_id: sandboxId,
        status: "stopped",
        message: "Sandbox terminated successfully",
      },
    });
  } catch (error) {
    logger.error(
      { error, sandbox_id: req.params.id },
      "Error stopping sandbox",
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;

// Made with Bob
