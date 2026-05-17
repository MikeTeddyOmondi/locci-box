import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const dbPath = process.env.DB_PATH || "./data/locci-box";

const client = new PGlite(dbPath);
export const db = drizzle({ client, schema });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDb(): Promise<void> {
  logger.info({ path: dbPath }, "Initializing database");

  // Resolve migrations folder relative to this file so it works after tsc compilation
  // In dev: src/db/ -> ../../drizzle; in dist: dist/db/ -> ../../drizzle
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");

  await migrate(db, { migrationsFolder });

  await seedDefaults();

  logger.info("Database initialized");
}

async function seedDefaults(): Promise<void> {
  const [existingTenant] = await db
    .select()
    .from(schema.tenants)
    .where(sql`id = 'tenant_default'`);

  if (!existingTenant) {
    await db.insert(schema.tenants).values({
      id: "tenant_default",
      apiKey: env.ADMIN_API_KEY,
      organization: "Default Organization",
      maxConcurrentSandboxes: env.DEFAULT_MAX_CONCURRENT_SANDBOXES,
      maxExecutionTimeSeconds: env.DEFAULT_SANDBOX_TIMEOUT_SECONDS,
      rateLimitPerMinute: env.DEFAULT_RATE_LIMIT_PER_MINUTE,
      activeSandboxes: 0,
      totalExecutions: 0,
      createdAt: new Date().toISOString(),
    });
    logger.info("Default tenant seeded");
  }

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(sql`email = 'box@locci.cloud'`);

  if (!existingUser) {
    const hash = await bcrypt.hash("demo1234", 10);
    await db.insert(schema.users).values({
      id: "user_demo",
      email: "box@locci.cloud",
      passwordHash: hash,
      org: "Demo",
      createdAt: new Date().toISOString(),
    });
    logger.info("Demo user seeded (email: box@locci.cloud, password: demo1234)");
  }
}
