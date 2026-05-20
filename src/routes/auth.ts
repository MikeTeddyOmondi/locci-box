import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { userService } from "../services/UserService.js";
import { tenantService } from "../services/TenantService.js";
import { tokenRevocationService } from "../services/TokenRevocationService.js";
import { authenticate } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 h

function signToken(userId: string, email: string, tenantId: string): string {
  const jti = nanoid();
  return jwt.sign({ userId, email, tenantId, jti }, env.JWT_SECRET!, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
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
 * GET /api/auth/verify
 * Returns 200 if the Bearer JWT is valid, 401 otherwise.
 * Used by the web server's Bob route to avoid duplicating JWT_SECRET.
 */
router.get("/verify", authenticate, (_req: Request, res: Response): void => {
  res.json({ success: true });
});

/**
 * POST /api/auth/logout
 * Revokes the JWT so it cannot be reused before expiry.
 */
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, env.JWT_SECRET!) as {
          jti?: string;
          exp?: number;
        };
        if (payload.jti && payload.exp) {
          const expiresAt = new Date(payload.exp * 1000).toISOString();
          await tokenRevocationService.revoke(payload.jti, expiresAt);
        }
      } catch {
        // Invalid token — still return success (idempotent logout)
      }
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Logout error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
