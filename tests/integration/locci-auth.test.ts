import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Locci Auth stands in here: one valid access token, and one valid API key
// that trades for it.
const locci = vi.hoisted(() => {
  const email = `locci_${Math.random().toString(36).slice(2)}@test.com`;
  return {
    email,
    token: "eyJlocci.alice.token",
    key: "locci_sk_live_alicekey",
    /** The issuer unreachable. */
    down: false,
    AuthUnavailableError: class AuthUnavailableError extends Error {},
  };
});

vi.mock("../../src/services/LocciAuth.js", () => ({
  LOCCI_KEY_PREFIX: "locci_sk_live_",
  AuthUnavailableError: locci.AuthUnavailableError,
  locciAuthEnabled: () => true,
  verifyLocciToken: async (token: string) => {
    if (locci.down) throw new locci.AuthUnavailableError(new Error("ECONNREFUSED"));
    return token === locci.token ? { id: "user:alice", email: locci.email } : null;
  },
  exchangeLocciKey: async (key: string) => (key === locci.key ? locci.token : null),
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



  it("answers 503, not 401, when Locci Auth cannot be reached", async () => {
    locci.down = true;
    try {
      const res = await request(app).get("/api/boxes").set("Authorization", `Bearer ${locci.token}`);
      expect(res.status).toBe(503);
      expect((await request(app).get("/api/boxes").set("Authorization", `Bearer ${locci.key}`)).status).toBe(503);
    } finally {
      locci.down = false;
    }
    expect((await request(app).get("/api/boxes").set("Authorization", `Bearer ${locci.token}`)).status).toBe(200);
  });
});
