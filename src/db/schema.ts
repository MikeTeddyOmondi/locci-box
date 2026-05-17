import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  apiKey: text("api_key").notNull().unique(),
  organization: text("organization").notNull(),
  maxConcurrentSandboxes: integer("max_concurrent_sandboxes").notNull().default(5),
  maxExecutionTimeSeconds: integer("max_execution_time_seconds").notNull().default(30),
  rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
  activeSandboxes: integer("active_sandboxes").notNull().default(0),
  totalExecutions: integer("total_executions").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  org: text("org").notNull(),
  createdAt: text("created_at").notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  status: text("status").notNull().default("active"),
  rateLimit: integer("rate_limit"),
  maxConcurrent: integer("max_concurrent").notNull().default(5),
  timeoutSeconds: integer("timeout_seconds").notNull().default(30),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at"),
});

export const sandboxRuns = pgTable("sandbox_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  language: text("language").notNull(),
  status: text("status").notNull(),
  exitCode: integer("exit_code").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: text("created_at").notNull(),
});
