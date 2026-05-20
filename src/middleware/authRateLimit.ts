import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

interface Bucket {
  attempts: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;  // 1 minute
const MAX_ATTEMPTS = 10;   // per IP per window

const buckets = new Map<string, Bucket>();

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);
  const now = Date.now();

  let bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { attempts: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.attempts += 1;

  if (bucket.attempts > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    logger.warn({ ip, attempts: bucket.attempts }, "Auth rate limit exceeded");
    res.status(429).json({
      success: false,
      error: "Too many attempts, please try again later",
      retry_after: retryAfter,
    });
    return;
  }

  next();
}

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(ip);
  }
}, 5 * 60_000);
