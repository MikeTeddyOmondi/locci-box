import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { logger } from "../utils/logger.js";

export interface UserApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  status: "active" | "revoked";
  rateLimit: number | null;
  maxConcurrent: number;
  timeoutSeconds: number;
  createdAt: string;
  lastUsedAt: string | null;
}

function toApiKey(row: typeof apiKeys.$inferSelect): UserApiKey {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    key: row.key,
    status: row.status as "active" | "revoked",
    rateLimit: row.rateLimit,
    maxConcurrent: row.maxConcurrent,
    timeoutSeconds: row.timeoutSeconds,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

class ApiKeyService {
  async listByUser(userId: string): Promise<UserApiKey[]> {
    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(sql`created_at DESC`);
    return rows.map(toApiKey);
  }

  async getByKey(key: string): Promise<UserApiKey | null> {
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.key, key));
    return row ? toApiKey(row) : null;
  }

  async getById(id: string): Promise<UserApiKey | null> {
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return row ? toApiKey(row) : null;
  }

  async create(
    userId: string,
    name: string,
    opts: { rateLimit?: number | null; maxConcurrent?: number; timeoutSeconds?: number },
  ): Promise<UserApiKey> {
    const [row] = await db
      .insert(apiKeys)
      .values({
        id: `key_${nanoid(12)}`,
        userId,
        name,
        key: `sk_live_${nanoid(32)}`,
        status: "active",
        rateLimit: opts.rateLimit ?? 100,
        maxConcurrent: opts.maxConcurrent ?? 5,
        timeoutSeconds: opts.timeoutSeconds ?? 30,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      })
      .returning();

    logger.info({ key_id: row.id, user_id: userId }, "API key created");
    return toApiKey(row);
  }

  async revoke(keyId: string, userId: string): Promise<boolean> {
    const key = await this.getById(keyId);
    if (!key || key.userId !== userId) return false;
    await db.update(apiKeys).set({ status: "revoked" }).where(eq(apiKeys.id, keyId));
    logger.info({ key_id: keyId, user_id: userId }, "API key revoked");
    return true;
  }

  async delete(keyId: string, userId: string): Promise<boolean> {
    const key = await this.getById(keyId);
    if (!key || key.userId !== userId) return false;
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    logger.info({ key_id: keyId, user_id: userId }, "API key deleted");
    return true;
  }

  async markUsed(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, keyId));
  }
}

export const apiKeyService = new ApiKeyService();
