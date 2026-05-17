import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("GET /health", () => {
  it("returns 200 with healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("healthy");
    expect(res.body.data).toHaveProperty("timestamp");
    expect(res.body.data).toHaveProperty("uptime");
  });
});
