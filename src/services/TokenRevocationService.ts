import { db } from "../db/index.js";
import { revokedTokens } from "../db/schema.js";
import { eq, lt } from "drizzle-orm";

class TokenRevocationService {
  async revoke(jti: string, expiresAt: string): Promise<void> {
    await db
      .insert(revokedTokens)
      .values({ jti, expiresAt })
      .onConflictDoNothing();
  }

  async isRevoked(jti: string): Promise<boolean> {
    const [row] = await db
      .select({ jti: revokedTokens.jti })
      .from(revokedTokens)
      .where(eq(revokedTokens.jti, jti))
      .limit(1);
    return !!row;
  }

  async cleanup(): Promise<void> {
    await db
      .delete(revokedTokens)
      .where(lt(revokedTokens.expiresAt, new Date().toISOString()));
  }
}

export const tokenRevocationService = new TokenRevocationService();

// Prune expired entries every hour
setInterval(() => tokenRevocationService.cleanup(), 60 * 60 * 1000);
