import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Locci Auth stands in here: one valid access token, one valid API key that
// trades for it, and a /keys endpoint that records what it was asked.
const locci = vi.hoisted(() => {
  const email = `locci_${Math.random().toString(36).slice(2)}@test.com`;
  return {
    email,
    token: "eyJlocci.alice.token",
    key: "locci_sk_live_alicekey",
    keyCalls: [] as { accessToken: string; path: string; method: string; body?: string }[],
  };
});

vi.mock("../../src/services/LocciAuth.js", () => ({
  LOCCI_KEY_PREFIX: "locci_sk_live_",
  locciAuthEnabled: () => true,
  verifyLocciToken: async (token: string) => (token === locci.token ? { id: "user:alice", email: locci.email } : null),
  exchangeLocciKey: async (key: string) => (key === locci.key ? locci.token : null),
  locciKeysRequest: async (accessToken: string, path: string, init: RequestInit = {}) => {
    locci.keyCalls.push({ accessToken, path, method: init.method ?? "GET", body: init.body as string | undefined });
    const body = init.method === "POST" ? { key: "locci_sk_live_new", summary: { id: "k1" } } : { keys: [] };
    return new Response(JSON.stringify(body), { status: init.method === "POST" ? 201 : 200 });
  },
}));

const { createApp } = await import("../../src/app.js");
const { userService } = await import("../../src/services/UserService.js");
const app = createApp();

describe("Locci Auth", () => {
  it("signs in with a Locci access token, creating the local user once", async () => {
    const first = await request(app).get("/api/boxes").set("Authorization", `Bearer ${locci.token}`);
    expect(first.status).toBe(200);
    const user = await userService.findByEmail(locci.email);
    expect(user).not.toBeNull();
    await request(app).get("/api/boxes").set("Authorization", `Bearer ${locci.token}`);
    expect((await userService.findByEmail(locci.email))!.id).toBe(user!.id);
  });

  it("accepts a Locci API key as the same user", async () => {
    const thread = await request(app).post("/api/bob/threads").set("Authorization", `Bearer ${locci.token}`).send({ title: "t" });
    expect(thread.status).toBe(201);
    const viaKey = await request(app).get("/api/bob/threads").set("Authorization", `Bearer ${locci.key}`);
    expect(viaKey.status).toBe(200);
    expect(viaKey.body.data.map((t: { id: string }) => t.id)).toContain(thread.body.data.id);
  });

  it("refuses an unknown Locci key and a token Locci Auth did not sign", async () => {
    expect((await request(app).get("/api/boxes").set("Authorization", "Bearer locci_sk_live_nope")).status).toBe(401);
    expect((await request(app).get("/api/boxes").set("Authorization", "Bearer eyJnot.a.token")).status).toBe(401);
  });

  it("manages keys at Locci Auth with the caller's own access token", async () => {
    const list = await request(app).get("/api/locci-keys").set("Authorization", `Bearer ${locci.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual({ keys: [] });

    const made = await request(app)
      .post("/api/locci-keys")
      .set("Authorization", `Bearer ${locci.token}`)
      .send({ name: "ci", expiresInDays: 90 });
    expect(made.status).toBe(201);
    expect(made.body.data.key).toBe("locci_sk_live_new");

    await request(app).delete("/api/locci-keys/k1").set("Authorization", `Bearer ${locci.token}`);
    expect(locci.keyCalls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET ", "POST ", "DELETE /k1"]);
    expect(locci.keyCalls.every((c) => c.accessToken === locci.token)).toBe(true);
    expect(JSON.parse(locci.keyCalls[1].body!)).toEqual({ name: "ci", expiresInDays: 90 });
  });

  it("does not let an API key manage keys", async () => {
    const res = await request(app).get("/api/locci-keys").set("Authorization", `Bearer ${locci.key}`);
    expect(res.status).toBe(403);
  });
});
