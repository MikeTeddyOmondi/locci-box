import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();
const ADMIN_KEY = process.env.ADMIN_API_KEY!;

describe("GET /api/stats", () => {
  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(401);
  });

  it("rejects invalid API key", async () => {
    const res = await request(app)
      .get("/api/stats")
      .set("Authorization", "Bearer bogus_key");
    expect(res.status).toBe(401);
  });

  it("returns stats for default tenant via admin key", async () => {
    const res = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data).toHaveProperty("tenant_id");
    expect(data).toHaveProperty("total_runs");
    expect(data).toHaveProperty("active_sandboxes");
    expect(data).toHaveProperty("avg_execution_ms");
    expect(data).toHaveProperty("recent_runs");
    expect(data).toHaveProperty("daily_runs");
    expect(data).toHaveProperty("success_runs");
  });

  it("daily_runs contains 7 buckets", async () => {
    const res = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.daily_runs)).toBe(true);
    expect(res.body.data.daily_runs).toHaveLength(7);
  });

  it("recent_runs is an array", async () => {
    const res = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(Array.isArray(res.body.data.recent_runs)).toBe(true);
  });

  it("returns stats via JWT from demo user login", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "box@locci.cloud", password: "demo1234" });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.token;

    const res = await request(app)
      .get("/api/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
