import { Router, Request, Response } from "express";

const router: Router = Router();

/**
 * GET /health
 * Health check endpoint - returns service status
 */
router.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;

// Made with Bob
