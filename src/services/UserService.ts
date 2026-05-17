import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { logger } from "../utils/logger.js";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  org: string;
  createdAt: string;
}

class UserService {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> id

  constructor() {
    this.seedDefaultUser();
  }

  private async seedDefaultUser(): Promise<void> {
    const hash = await bcrypt.hash("demo1234", 10);
    const user: User = {
      id: "user_demo",
      email: "demo@loccibox.dev",
      passwordHash: hash,
      org: "Demo",
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    logger.info({ email: user.email }, "Demo user seeded (password: demo1234)");
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(email: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hash = await bcrypt.hash(password, 10);
    const user: User = {
      id: `user_${nanoid(12)}`,
      email: email.toLowerCase(),
      passwordHash: hash,
      org: email.split("@")[1]?.split(".")[0] ?? "unknown",
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
    logger.info({ user_id: user.id, email: user.email }, "User registered");
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}

export const userService = new UserService();
