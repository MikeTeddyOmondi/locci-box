import { initDb } from "./db/index.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";
import { env, isDevelopment } from "./config/env.js";
import { boxService } from "./services/BoxService.js";

async function startServer() {
  try {
    await initDb();

    // Agent boxes: pick up the ones still running from before a restart, then
    // stop idle ones every minute. The box image is pulled in the background.
    await boxService.reconcile().catch((error) =>
      logger.error({ error: String(error) }, "Reconciling boxes failed"),
    );
    boxService.startSweeper();
    void boxService.warmImage();

    const app = createApp();

    app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, "Locci Box API server started");

      if (isDevelopment) {
        logger.info(`Default API key for testing: ${env.ADMIN_API_KEY}`);
        logger.info(`Health check: http://localhost:${env.PORT}/health`);
        logger.info(`API endpoint: http://localhost:${env.PORT}/api/sandbox/run`);
      }
    });
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

startServer();
