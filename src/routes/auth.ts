import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { userService } from "../services/UserService.js";
import { tenantService } from "../services/TenantService.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

function signToken(userId: string, email: string, tenantId: string): string {
  return jwt.sign({ userId, email, tenantId }, env.JWT_SECRET!, { expiresIn: "24h" });
}

/**
 * POST /api/auth/register
 * Creates a new user account and returns a JWT.
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "email and password are required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      return;
    }

    const user = await userService.create(email, password);

    // Web users share the default tenant
    const tenant = await tenantService.getById("tenant_default");
    if (!tenant) {
      res.status(500).json({ success: false, error: "Default tenant not found" });
      return;
    }

    const token = signToken(user.id, user.email, tenant.id);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, org: user.org },
      },
    });
  } catch (error: any) {
    if (error?.message === "Email already registered") {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, "Register error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "email and password are required" });
      return;
    }

    const user = await userService.findByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const valid = await userService.verifyPassword(user, password);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const tenant = await tenantService.getById("tenant_default");
    if (!tenant) {
      res.status(500).json({ success: false, error: "Default tenant not found" });
      return;
    }

    const token = signToken(user.id, user.email, tenant.id);

    logger.info({ user_id: user.id, email: user.email }, "User logged in");

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, org: user.org },
      },
    });
  } catch (error) {
    logger.error({ error }, "Login error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/auth/logout
 * Client-side only — just a no-op endpoint for clean UX.
 */
router.post("/logout", (_req: Request, res: Response): void => {
  res.json({ success: true });
});

export default router;
