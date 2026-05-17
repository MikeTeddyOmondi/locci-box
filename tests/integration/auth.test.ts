import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("Auth routes", () => {
  describe("POST /api/auth/register", () => {
    it("rejects missing email/password", async () => {
      const res = await request(app).post("/api/auth/register").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@example.com", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/i);
    });

    it("creates a new user and returns JWT", async () => {
      const email = `user_${Date.now()}@test.com`;
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(email);
    });

    it("rejects duplicate email", async () => {
      const email = `dup_${Date.now()}@test.com`;
      await request(app)
        .post("/api/auth/register")
        .send({ email, password: "password123" });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "password123" });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    it("rejects missing credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    });

    it("rejects wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "box@locci.cloud", password: "wrongpassword" });
      expect(res.status).toBe(401);
    });

    it("rejects unknown email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "password123" });
      expect(res.status).toBe(401);
    });

    it("logs in demo user and returns JWT", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "box@locci.cloud", password: "demo1234" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("box@locci.cloud");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("always returns success", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
