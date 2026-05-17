import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

vi.mock("../../src/services/SandboxService.js", () => ({
  sandboxService: {
    execute: vi.fn().mockImplementation(() =>
      Promise.resolve({
        sandbox_id: `sbox_${Math.random().toString(36).slice(2, 10)}`,
        status: "completed",
        stdout: "Hello, World!\n",
        stderr: "",
        exit_code: 0,
        duration_ms: 42,
        tenant_id: "tenant_default",
      }),
    ),
    getStatus: vi.fn().mockResolvedValue(null),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

const app = createApp();
const ADMIN_KEY = process.env.ADMIN_API_KEY!;

describe("POST /api/sandbox/run", () => {
  it("rejects missing authorization header", async () => {
    const res = await request(app).post("/api/sandbox/run").send({
      language: "python",
      code: 'print("hi")',
    });
    expect(res.status).toBe(401);
  });

  it("rejects invalid API key", async () => {
    const res = await request(app)
      .post("/api/sandbox/run")
      .set("Authorization", "Bearer invalid_key_xyz")
      .send({ language: "python", code: 'print("hi")' });
    expect(res.status).toBe(401);
  });

  it("rejects missing language and code", async () => {
    const res = await request(app)
      .post("/api/sandbox/run")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/language and code/i);
  });

  it("rejects unsupported language", async () => {
    const res = await request(app)
      .post("/api/sandbox/run")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ language: "go", code: 'fmt.Println("hi")' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid language/i);
  });

  it("rejects code exceeding 1MB", async () => {
    const res = await request(app)
      .post("/api/sandbox/run")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ language: "python", code: "a".repeat(1024 * 1024 + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1mb/i);
  });

  it("executes code via mocked sandbox and returns result", async () => {
    const res = await request(app)
      .post("/api/sandbox/run")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ language: "python", code: 'print("Hello, World!")' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sandbox_id).toMatch(/^sbox_/);
    expect(res.body.data.stdout).toBe("Hello, World!\n");
    expect(res.body.data.exit_code).toBe(0);
    expect(res.body.data.duration_ms).toBe(42);
  });

  it("accepts all supported languages", async () => {
    const langs = ["python", "node", "bash", "ruby"];
    for (const language of langs) {
      const res = await request(app)
        .post("/api/sandbox/run")
        .set("Authorization", `Bearer ${ADMIN_KEY}`)
        .send({ language, code: "echo hi" });
      expect(res.status).toBe(200);
    }
  });
});

describe("GET /api/sandbox/:id/status", () => {
  it("returns 404 for unknown sandbox id", async () => {
    const res = await request(app)
      .get("/api/sandbox/unknown_id/status")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(404);
  });
});
