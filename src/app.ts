import express, { Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger";
import { authenticate } from "./middleware/auth";
import { rateLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";
import healthRoutes from "./routes/health";
import sandboxRoutes from "./routes/sandbox";
import metricsRoutes from "./routes/metrics";

/**
 * Configure application middleware
 */
function configureMiddleware(app: Express): void {
  // CORS
  app.use(cors());

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(pinoHttp({ logger }));
}

/**
 * Configure application routes
 */
function configureRoutes(app: Express): void {
  // Public routes
  app.use("/health", healthRoutes);

  // Protected API routes
  app.use("/api/sandbox", authenticate, rateLimiter.limit(), sandboxRoutes);
  app.use("/api/metrics", metricsRoutes);
}

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Configure middleware
  configureMiddleware(app);

  // Configure routes
  configureRoutes(app);

  // Error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Made with Bob
