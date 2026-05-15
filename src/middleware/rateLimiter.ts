import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per minute
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token
   */
  tryConsume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000 / 60; // minutes
    const tokensToAdd = Math.floor(timePassed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Get seconds until next token is available
   */
  getRetryAfter(): number {
    const tokensNeeded = 1 - this.tokens;
    const minutesNeeded = tokensNeeded / this.refillRate;
    return Math.ceil(minutesNeeded * 60);
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  // In-memory store (use Redis in production)
  private buckets: Map<string, TokenBucket> = new Map();

  /**
   * Get or create bucket for tenant
   */
  private getBucket(tenantId: string, rateLimit: number): TokenBucket {
    let bucket = this.buckets.get(tenantId);

    if (!bucket) {
      bucket = new TokenBucket(rateLimit, rateLimit);
      this.buckets.set(tenantId, bucket);
    }

    return bucket;
  }

  /**
   * Rate limiting middleware
   */
  limit() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const tenant = (req as any).tenant;

      if (!tenant) {
        // No tenant means auth middleware hasn't run
        next();
        return;
      }

      const bucket = this.getBucket(tenant.id, tenant.rate_limit_per_minute);

      if (bucket.tryConsume(1)) {
        logger.debug({ tenant_id: tenant.id }, "Rate limit check passed");
        next();
      } else {
        const retryAfter = bucket.getRetryAfter();

        logger.warn(
          {
            tenant_id: tenant.id,
            organization: tenant.organization,
            retry_after: retryAfter,
          },
          "Rate limit exceeded",
        );

        res.status(429).json({
          success: false,
          error: "Rate limit exceeded",
          retry_after: retryAfter,
        });
      }
    };
  }

  /**
   * Clean up old buckets (call periodically)
   */
  cleanup(): void {
    // Remove buckets that haven't been used in 10 minutes
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;

    for (const [tenantId, bucket] of this.buckets.entries()) {
      if (now - (bucket as any).lastRefill > maxAge) {
        this.buckets.delete(tenantId);
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Clean up old buckets every 5 minutes
setInterval(
  () => {
    rateLimiter.cleanup();
  },
  5 * 60 * 1000,
);

// Made with Bob
