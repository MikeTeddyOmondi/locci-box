import * as v from "valibot";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable schema using Valibot
 * This provides type-safe, validated access to all environment variables
 */
const EnvSchema = v.object({
  // Server Configuration
  PORT: v.optional(v.pipe(v.string(), v.transform(Number)), "3000"),
  NODE_ENV: v.optional(
    v.picklist(["development", "production", "test"]),
    "development",
  ),

  // Admin Configuration
  ADMIN_API_KEY: v.pipe(
    v.string(),
    v.minLength(1, "ADMIN_API_KEY is required"),
  ),

  // Sandbox Defaults
  DEFAULT_MAX_CONCURRENT_SANDBOXES: v.optional(
    v.pipe(v.string(), v.transform(Number), v.minValue(1)),
    "5",
  ),
  DEFAULT_SANDBOX_TIMEOUT_SECONDS: v.optional(
    v.pipe(v.string(), v.transform(Number), v.minValue(1)),
    "30",
  ),
  DEFAULT_RATE_LIMIT_PER_MINUTE: v.optional(
    v.pipe(v.string(), v.transform(Number), v.minValue(1)),
    "60",
  ),

  // Logging
  LOG_LEVEL: v.optional(
    v.picklist(["trace", "debug", "info", "warn", "error", "fatal"]),
    "info",
  ),

  // MCP Server
  MCP_ENABLED: v.optional(
    v.pipe(
      v.string(),
      v.transform((val) => val !== "false"),
    ),
    "true",
  ),

  // Database (optional for now)
  DATABASE_URL: v.optional(v.string()),
});

/**
 * Parse and validate environment variables
 */
function parseEnv() {
  try {
    const parsed = v.parse(EnvSchema, {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      ADMIN_API_KEY: process.env.ADMIN_API_KEY,
      DEFAULT_MAX_CONCURRENT_SANDBOXES:
        process.env.DEFAULT_MAX_CONCURRENT_SANDBOXES,
      DEFAULT_SANDBOX_TIMEOUT_SECONDS:
        process.env.DEFAULT_SANDBOX_TIMEOUT_SECONDS,
      DEFAULT_RATE_LIMIT_PER_MINUTE: process.env.DEFAULT_RATE_LIMIT_PER_MINUTE,
      LOG_LEVEL: process.env.LOG_LEVEL,
      MCP_ENABLED: process.env.MCP_ENABLED,
      DATABASE_URL: process.env.DATABASE_URL,
    });

    return parsed;
  } catch (error) {
    if (error instanceof v.ValiError) {
      console.error("❌ Environment variable validation failed:");
      console.error(
        error.issues
          .map(
            (issue) =>
              `  - ${issue.path?.map((p: { key: any }) => p.key).join(".")}: ${issue.message}`,
          )
          .join("\n"),
      );
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment configuration
 * Import this instead of using process.env directly
 */
export const env = parseEnv();

/**
 * Type of the environment configuration
 */
export type Env = typeof env;

/**
 * Helper to check if running in production
 */
export const isProduction = env.NODE_ENV === "production";

/**
 * Helper to check if running in development
 */
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Helper to check if running in test
 */
export const isTest = env.NODE_ENV === "test";

// Made with Bob
