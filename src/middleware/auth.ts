import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantService } from "../services/TenantService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Authentication middleware - supports both JWT (web) and API key (CLI).
 * JWT tokens (web app) are identified by the "eyJ" prefix and map to the default tenant.
 * API keys (CLI) map directly to tenant records in TenantService.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ success: false, error: "No authorization header provided" });
      return;
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      res.status(401).json({ success: false, error: "No credentials provided" });
      return;
    }

    // Try JWT first (web app — JWTs always start with "eyJ")
    if (token.startsWith("eyJ")) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET!) as {
          userId: string;
          email: string;
          tenantId: string;
        };
        const tenant = await tenantService.getById(payload.tenantId);
        if (!tenant) {
          res.status(401).json({ success: false, error: "Invalid token" });
          return;
        }
        (req as any).tenant = tenant;
        (req as any).tenantId = tenant.id;
        (req as any).userId = payload.userId;
        logger.debug({ user_id: payload.userId, tenant_id: tenant.id }, "JWT authenticated");
        next();
        return;
      } catch {
        res.status(401).json({ success: false, error: "Invalid or expired token" });
        return;
      }
    }

    // Fall back to API key (CLI)
    const tenant = await tenantService.getByApiKey(token);
    if (!tenant) {
      logger.warn({ api_key_prefix: token.substring(0, 10) }, "Invalid API key");
      res.status(401).json({ success: false, error: "Invalid API key" });
      return;
    }

    (req as any).tenant = tenant;
    (req as any).tenantId = tenant.id;
    logger.debug({ tenant_id: tenant.id, organization: tenant.organization }, "API key authenticated");
    next();
  } catch (error) {
    logger.error({ error }, "Authentication error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

/**
 * Admin authentication middleware - validates admin API key
 */
export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const adminKey = env.ADMIN_API_KEY;

  if (!authHeader) {
    res.status(401).json({ success: false, error: "No authorization header provided" });
    return;
  }

  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader;

  if (providedKey !== adminKey) {
    logger.warn("Invalid admin API key attempt");
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  next();
}
