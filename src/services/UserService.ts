import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { logger } from "../utils/logger.js";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  org: string;
  createdAt: string;
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    org: row.org,
    createdAt: row.createdAt,
  };
}

class UserService {
  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row ? toUser(row) : null;
  }

  async create(email: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hash = await bcrypt.hash(password, 10);
    const [row] = await db
      .insert(users)
      .values({
        id: `user_${nanoid(12)}`,
        email: email.toLowerCase(),
        passwordHash: hash,
        org: email.split("@")[1]?.split(".")[0] ?? "unknown",
        createdAt: new Date().toISOString(),
      })
      .returning();

    logger.info({ user_id: row.id, email: row.email }, "User registered");
    return toUser(row);
  }

  /**
   * The local user for someone signed in with Locci Auth, created on first
   * sight. Matched by email, so an account registered here with a password is
   * the same user. A new one gets a random password nobody knows: it signs in
   * through Locci Auth only.
   */
  async findOrCreateForLocci(email: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    try {
      return await this.create(email, randomBytes(32).toString("base64url"));
    } catch (error) {
      // Two first requests at once: the other one created it.
      const raced = await this.findByEmail(email);
      if (raced) return raced;
      throw error;
    }
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}

export const userService = new UserService();
