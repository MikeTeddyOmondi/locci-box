import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();
let jwtToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "box@locci.cloud", password: "demo1234" });
  jwtToken = res.body.data.token;
});

describe("API Keys CRUD", () => {
  describe("GET /api/keys", () => {
    it("rejects unauthenticated request", async () => {
      const res = await request(app).get("/api/keys");
      expect(res.status).toBe(401);
    });

    it("rejects admin API key (no userId)", async () => {
      const res = await request(app)
        .get("/api/keys")
        .set("Authorization", `Bearer ${process.env.ADMIN_API_KEY}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/jwt/i);
    });

    it("returns empty array for user with no keys", async () => {
      const res = await request(app)
        .get("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("POST /api/keys", () => {
    it("rejects missing name", async () => {
      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it("creates a key and returns it with full value", async () => {
      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({ name: "Test Key" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toMatch(/^lbk_live_/);
      expect(res.body.data.name).toBe("Test Key");
      expect(res.body.data.status).toBe("active");
    });
  });

  describe("PATCH /api/keys/:id/revoke + DELETE /api/keys/:id", () => {
    let createdKeyId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({ name: "Revoke Me" });
      createdKeyId = res.body.data.id;
    });

    it("GET /api/keys returns masked key", async () => {
      const res = await request(app)
        .get("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      const keys = res.body.data;
      expect(keys.some((k: any) => k.id === createdKeyId)).toBe(true);
      const key = keys.find((k: any) => k.id === createdKeyId);
      expect(key.key).toContain("…");
      expect(key.key).toMatch(/^lbk_live_/);
    });

    it("revokes the key", async () => {
      const res = await request(app)
        .patch(`/api/keys/${createdKeyId}/revoke`)
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 when revoking non-existent key", async () => {
      const res = await request(app)
        .patch("/api/keys/key_nonexistent/revoke")
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(404);
    });

    it("deletes a key", async () => {
      const createRes = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${jwtToken}`)
        .send({ name: "Delete Me" });
      const keyId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/keys/${keyId}`)
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 404 when deleting non-existent key", async () => {
      const res = await request(app)
        .delete("/api/keys/key_nonexistent")
        .set("Authorization", `Bearer ${jwtToken}`);
      expect(res.status).toBe(404);
    });
  });
});
