import express, { Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger.js";
import { isDevelopment } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import healthRoutes from "./routes/health.js";
import sandboxRoutes from "./routes/sandbox.js";
import metricsRoutes from "./routes/metrics.js";
import authRoutes from "./routes/auth.js";

function configureMiddleware(app: Express): void {
  app.use(
    cors({
      // Allow all origins in dev; restrict to known origins in production
      origin: isDevelopment ? true : [/\.loccibox\.dev$/, /^https:\/\/loccibox\.dev$/],
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));
}

function configureRoutes(app: Express): void {
  // Public routes
  app.use("/health", healthRoutes);
  app.use("/api/auth", authRoutes);

  // Protected API routes
  app.use("/api/sandbox", authenticate, rateLimiter.limit(), sandboxRoutes);
  app.use("/api/metrics", metricsRoutes);
}

export function createApp(): Express {
  const app = express();
  configureMiddleware(app);
  configureRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
