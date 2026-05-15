import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input or validation error
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Not found") {
    super(404, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = "Rate limit exceeded",
    public retryAfter?: number,
  ) {
    super(429, message);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable") {
    super(503, message);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Global error handler middleware
 * Handles all errors thrown in the application
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Log error with context
  logger.error(
    {
      err,
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    },
    "Request error",
  );

  // Handle known application errors
  if (err instanceof AppError) {
    const response: any = {
      success: false,
      error: err.message,
    };

    // Add retry_after for rate limit errors
    if (err instanceof RateLimitError && err.retryAfter) {
      response.retry_after = err.retryAfter;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors (don't expose internal details)
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}

// Made with Bob
