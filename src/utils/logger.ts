import pino from "pino";
import { env, isDevelopment } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

// Made with Bob
