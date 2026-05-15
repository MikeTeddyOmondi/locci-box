import { Request, Response } from "express";

/**
 * 404 Not Found handler middleware
 * Handles all requests that don't match any defined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "Not found",
  });
}

// Made with Bob
