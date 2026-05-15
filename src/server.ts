import { createApp } from "./app";
import { logger } from "./utils/logger";
import { env, isDevelopment } from "./config/env";

/**
 * Start the Express server
 */
async function startServer() {
  try {
    const app = createApp();

    app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
        },
        "Locci Box API server started",
      );

      if (isDevelopment) {
        logger.info("Default API key for testing: sk_test_default_key_12345");
        logger.info(`Health check: http://localhost:${env.PORT}/health`);
        logger.info(
          `API endpoint: http://localhost:${env.PORT}/api/sandbox/run`,
        );
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start the server
startServer();

// Made with Bob
