import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantService } from "../services/TenantService.js";
import { apiKeyService } from "../services/ApiKeyService.js";
import { tokenRevocationService } from "../services/TokenRevocationService.js";
import { userService } from "../services/UserService.js";
import {
  AuthUnavailableError,
  exchangeLocciKey,
  LOCCI_KEY_PREFIX,
  verifyLocciToken,
  type LocciUser,
} from "../services/LocciAuth.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Authentication middleware — supports JWT (web) and API key (CLI/user keys).
 *
 * JWT tokens: decoded to get userId + tenantId (attached by /api/auth/login).
 * Locci Auth access tokens and Locci API keys (locci_sk_live_*, LOCCI_AUTH_ISSUER): the user
 * with that email, created on first sight, in tenant_default.
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
        // Not one of ours: a Locci Auth access token (the web console signs in there).
        const locci = await verifyLocciToken(token).catch(unavailable(res));
        if (locci === undefined) return;
        if (!locci) {
          res.status(401).json({ success: false, error: "Invalid or expired token" });
          return;
        }
        if (await asLocciUser(req, res, locci, token)) next();
        return;
      }
    }

    // A Locci API key: traded for an access token at Locci Auth.
    if (token.startsWith(LOCCI_KEY_PREFIX)) {
      const access = await exchangeLocciKey(token).catch(unavailable(res));
      if (access === undefined) return;
      const locci = access ? await verifyLocciToken(access).catch(unavailable(res)) : null;
      if (locci === undefined) return;
      if (!locci) {
        res.status(401).json({ success: false, error: "Invalid API key" });
        return;
      }
      if (await asLocciUser(req, res, locci)) next();
      return;
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
 * Locci Auth could not be reached: answer 503 (the credential may be fine, and
 * a 401 would send the caller to replace one that is not the problem) and
 * resolve to undefined. Anything else is rethrown.
 */
function unavailable(res: Response) {
  return (error: unknown): undefined => {
    if (!(error instanceof AuthUnavailableError)) throw error;
    logger.error({ error: String(error.cause) }, "Locci Auth unreachable");
    res.status(503).json({ success: false, error: "Could not verify the credential right now; retry shortly" });
    return undefined;
  };
}

/**
 * Attach a Locci Auth user: the local user with their email (created on first
 * sight) in tenant_default. `accessToken` is kept for calls back to Locci Auth
 * on their behalf (key management). False when the response was already sent.
 */
async function asLocciUser(req: Request, res: Response, locci: LocciUser, accessToken?: string): Promise<boolean> {
  const tenant = await tenantService.getById("tenant_default");
  if (!tenant) {
    res.status(500).json({ success: false, error: "Default tenant not found" });
    return false;
  }
  const user = await userService.findOrCreateForLocci(locci.email);
  (req as any).tenant = tenant;
  (req as any).tenantId = tenant.id;
  (req as any).userId = user.id;
  (req as any).locciAccessToken = accessToken;
  logger.debug({ user_id: user.id, locci_id: locci.id }, "Locci Auth authenticated");
  return true;
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
