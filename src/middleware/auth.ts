import { Request, Response, NextFunction } from "express";
import { tenantService } from "../services/TenantService.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Authentication middleware - validates API key from Authorization header
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: "No authorization header provided",
      });
      return;
    }

    // Support both "Bearer <key>" and direct key formats
    const apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "No API key provided",
      });
      return;
    }

    // Validate API key and get tenant
    const tenant = await tenantService.getByApiKey(apiKey);

    if (!tenant) {
      logger.warn(
        { api_key_prefix: apiKey.substring(0, 10) },
        "Invalid API key",
      );
      res.status(401).json({
        success: false,
        error: "Invalid API key",
      });
      return;
    }

    // Attach tenant info to request
    (req as any).tenant = tenant;
    (req as any).tenantId = tenant.id;

    logger.debug(
      { tenant_id: tenant.id, organization: tenant.organization },
      "Request authenticated",
    );

    next();
  } catch (error) {
    logger.error({ error }, "Authentication error");
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
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
    res.status(401).json({
      success: false,
      error: "No authorization header provided",
    });
    return;
  }

  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader;

  if (providedKey !== adminKey) {
    logger.warn("Invalid admin API key attempt");
    res.status(403).json({
      success: false,
      error: "Forbidden",
    });
    return;
  }

  next();
}

// Made with Bob
