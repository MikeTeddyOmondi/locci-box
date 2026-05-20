import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantService } from "../services/TenantService.js";
import { apiKeyService } from "../services/ApiKeyService.js";
import { tokenRevocationService } from "../services/TokenRevocationService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Authentication middleware — supports JWT (web) and API key (CLI/user keys).
 *
 * JWT tokens: decoded to get userId + tenantId (attached by /api/auth/login).
 * Admin API key (lbk_live_*): looked up in tenants table.
 * User API key (lbk_live_*): looked up in api_keys table → maps to tenant_default.
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

    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    if (!token) {
      res.status(401).json({ success: false, error: "No credentials provided" });
      return;
    }

    // JWT (web login) — always starts with "eyJ"
    if (token.startsWith("eyJ")) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET!) as {
          userId: string;
          email: string;
          tenantId: string;
          jti?: string;
        };
        if (payload.jti && (await tokenRevocationService.isRevoked(payload.jti))) {
          res.status(401).json({ success: false, error: "Token has been revoked" });
          return;
        }
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

    // Admin/tenant API key — check tenants table first
    const tenantByKey = await tenantService.getByApiKey(token);
    if (tenantByKey) {
      (req as any).tenant = tenantByKey;
      (req as any).tenantId = tenantByKey.id;
      logger.debug({ tenant_id: tenantByKey.id }, "Tenant API key authenticated");
      next();
      return;
    }

    // User API key — check api_keys table
    const userKey = await apiKeyService.getByKey(token);
    if (userKey && userKey.status === "active") {
      const tenant = await tenantService.getById("tenant_default");
      if (!tenant) {
        res.status(500).json({ success: false, error: "Default tenant not found" });
        return;
      }
      (req as any).tenant = tenant;
      (req as any).tenantId = tenant.id;
      (req as any).userId = userKey.userId;
      await apiKeyService.markUsed(userKey.id);
      logger.debug({ key_id: userKey.id, user_id: userKey.userId }, "User API key authenticated");
      next();
      return;
    }

    logger.warn({ prefix: token.substring(0, 10) }, "Invalid API key");
    res.status(401).json({ success: false, error: "Invalid API key" });
  } catch (error) {
    logger.error({ error }, "Authentication error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

/**
 * Admin authentication middleware — validates admin API key only.
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
