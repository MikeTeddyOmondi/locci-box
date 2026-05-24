import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm/sql/sql";
import bcrypt from "bcryptjs";
import * as schema from "./schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// PGLite (dev)
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePGLite } from "drizzle-orm/pglite";
import { migrate as migratePGLite } from "drizzle-orm/pglite/migrator";

// PostgreSQL (prod)
import pg from "pg";
import { drizzle as drizzlePG } from "drizzle-orm/node-postgres";
import { migrate as migratePG } from "drizzle-orm/node-postgres/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type MigrateFn = (db: any, config: { migrationsFolder: string }) => Promise<void>;

let db: ReturnType<typeof drizzlePGLite> | ReturnType<typeof drizzlePG>;
let migrateFn: MigrateFn;

if (env.DATABASE_MODE === "postgresql") {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DATABASE_MODE=postgresql");
  }
  db = drizzlePG(new pg.Pool({ connectionString: env.DATABASE_URL }), { schema });
  migrateFn = migratePG;
} else {
  db = drizzlePGLite(new PGlite(env.DB_PATH), { schema });
  migrateFn = migratePGLite;
}

export { db };

export async function initDb(): Promise<void> {
  const label =
    env.DATABASE_MODE === "postgresql"
      ? `PostgreSQL (${env.DATABASE_URL})`
      : `PGLite (${env.DB_PATH})`;
  logger.info({ path: label }, "Initializing database");

  // Resolve migrations folder: src/db/ -> ../../drizzle; dist/db/ -> ../../drizzle
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");

  await migrateFn(db, { migrationsFolder });

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
