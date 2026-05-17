import { Router, Request, Response } from "express";
import { apiKeyService } from "../services/ApiKeyService.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

function requireJwt(req: Request, res: Response): string | null {
  const userId = (req as any).userId;
  if (!userId) {
    res.status(403).json({ success: false, error: "JWT authentication required for key management" });
    return null;
  }
  return userId;
}

/**
 * GET /api/keys — list user's API keys (masked)
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireJwt(req, res);
    if (!userId) return;

    const keys = await apiKeyService.listByUser(userId);
    res.json({
      success: true,
      data: keys.map((k) => ({
        ...k,
        key: `${k.key.slice(0, 14)}…${k.key.slice(-4)}`,
      })),
    });
  } catch (error) {
    logger.error({ error }, "Error listing keys");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/keys — create a new API key (returns full key once)
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireJwt(req, res);
    if (!userId) return;

    const { name, rateLimit, maxConcurrent, timeoutSeconds } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }

    const key = await apiKeyService.create(userId, name.trim(), {
      rateLimit: rateLimit ?? 100,
      maxConcurrent: maxConcurrent ?? 5,
      timeoutSeconds: timeoutSeconds ?? 30,
    });

    res.status(201).json({ success: true, data: key });
  } catch (error) {
    logger.error({ error }, "Error creating key");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * PATCH /api/keys/:id/revoke — revoke a key
 */
router.patch("/:id/revoke", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireJwt(req, res);
    if (!userId) return;

    const ok = await apiKeyService.revoke(req.params.id, userId);
    if (!ok) {
      res.status(404).json({ success: false, error: "Key not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error revoking key");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * DELETE /api/keys/:id — delete a key
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireJwt(req, res);
    if (!userId) return;

    const ok = await apiKeyService.delete(req.params.id, userId);
    if (!ok) {
      res.status(404).json({ success: false, error: "Key not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting key");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
