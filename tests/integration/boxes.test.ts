import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

// A stand-in for microsandbox: no microVMs in CI. Each fake sandbox records
// the commands it ran; builders accept any chained call.
const vm = vi.hoisted(() => {
  class ExecTimeoutError extends Error {}
  class SandboxNotFoundError extends Error {}
  class SandboxStillRunningError extends Error {}
  const files = new Map<string, Buffer>();
  const state = {
    created: [] as string[],
    restarted: [] as string[],
    removed: [] as string[],
    stopped: [] as string[],
    commands: [] as string[],
    running: new Set<string>(),
  };
  const sandbox = (name: string) => ({
    execWith: async (cmd: string, configure: (b: any) => any) => {
      const opts: { args: string[] } = { args: [] };
      const b: any = new Proxy({}, {
        get: (_t, key) => (...a: any[]) => {
          if (key === "args") opts.args = a[0];
          return b;
        },
      });
      configure(b);
      const line = [cmd, ...opts.args].join(" ");
      state.commands.push(line);
      if (line.includes("sleep 999")) throw new ExecTimeoutError("exec timed out");
      const out = line.includes("echo hi") ? "hi\n" : "";
      return { code: line.includes("false") ? 1 : 0, stdout: () => out, stderr: () => "" };
    },
    fs: () => ({
      write: async (p: string, data: Buffer) => void files.set(p, Buffer.from(data)),
      exists: async (p: string) => files.has(p),
      stat: async (p: string) => ({ kind: "file", size: files.get(p)!.length }),
      read: async (p: string) => files.get(p)!,
    }),
    stopAndWait: async () => {
      state.stopped.push(name);
      state.running.delete(name);
    },
    kill: async () => state.running.delete(name),
  });
  const chain = (onCreate: () => any): any =>
    new Proxy({}, { get: (_t, key) => (key === "createDetached" ? onCreate : () => chain(onCreate)) });
  const Sandbox = {
    builder: (name: string) =>
      chain(async () => {
        state.created.push(name);
        state.running.add(name);
        return sandbox(name);
      }),
    startDetached: async (name: string) => {
      state.restarted.push(name);
      state.running.add(name);
      return sandbox(name);
    },
    get: async (name: string) => ({
      status: state.running.has(name) ? "running" : "stopped",
      connect: async () => sandbox(name),
      stop: async () => state.running.delete(name),
    }),
    remove: async (name: string) => void state.removed.push(name),
  };
  const NetworkPolicy = { builder: () => chain(async () => ({})) };
  return { state, files, Sandbox, NetworkPolicy, ExecTimeoutError, SandboxNotFoundError, SandboxStillRunningError };
});

vi.mock("microsandbox", () => ({
  Sandbox: vm.Sandbox,
  NetworkPolicy: vm.NetworkPolicy,
  ExecTimeoutError: vm.ExecTimeoutError,
  SandboxNotFoundError: vm.SandboxNotFoundError,
  SandboxStillRunningError: vm.SandboxStillRunningError,
}));

const { createApp } = await import("../../src/app.js");
const { boxService } = await import("../../src/services/BoxService.js");
const { tenantService } = await import("../../src/services/TenantService.js");
const { db } = await import("../../src/db/index.js");
const { boxes } = await import("../../src/db/schema.js");
const { eq } = await import("drizzle-orm");

const app = createApp();
const ADMIN = `Bearer ${process.env.ADMIN_API_KEY}`;
let alice: string;
let bob: string;

async function register(): Promise<string> {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: `box_${Math.random().toString(36).slice(2)}@test.com`, password: "password123" });
  return `Bearer ${res.body.data.token}`;
}

async function activeCount(): Promise<number> {
  return (await tenantService.getById("tenant_default"))!.active_sandboxes;
}

beforeAll(async () => {
  alice = await register();
  bob = await register();
});

beforeEach(async () => {
  // Each test starts with no boxes and no counted sandboxes.
  for (const row of await db.select().from(boxes)) {
    await db.delete(boxes).where(eq(boxes.id, row.id));
  }
  while ((await activeCount()) > 0) await tenantService.decrementActive("tenant_default");
});

describe("agent boxes", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/api/boxes")).status).toBe(401);
  });

  it("creates a box that counts against the tenant's sandbox limit", async () => {
    const res = await request(app).post("/api/boxes").set("Authorization", alice);
    expect(res.status).toBe(201);
    expect(res.body.data.box_id).toMatch(/^box_/);
    expect(res.body.data.status).toBe("running");
    expect(res.body.data.workdir).toBe("/workspace");
    expect(res.body.data.idle_stop_at).toBeTruthy();
    expect(vm.state.created).toContain(res.body.data.box_id);
    expect(await activeCount()).toBe(1);
  });

  it("runs commands in /workspace and reports exit codes and timeouts", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;

    const ok = await request(app).post(`/api/boxes/${id}/exec`).set("Authorization", alice).send({ command: "echo hi" });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ exit_code: 0, stdout: "hi\n", timed_out: false });
    expect(vm.state.commands).toContain("/bin/sh -c echo hi");

    const failed = await request(app).post(`/api/boxes/${id}/exec`).set("Authorization", alice).send({ command: "false" });
    expect(failed.body.data.exit_code).toBe(1);

    const slow = await request(app)
      .post(`/api/boxes/${id}/exec`)
      .set("Authorization", alice)
      .send({ command: "sleep 999", timeout: 5 });
    expect(slow.body.data).toMatchObject({ exit_code: 124, timed_out: true });

    const empty = await request(app).post(`/api/boxes/${id}/exec`).set("Authorization", alice).send({});
    expect(empty.status).toBe(400);
  });

  it("writes and reads files, relative paths under /workspace", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;

    const put = await request(app)
      .put(`/api/boxes/${id}/files`)
      .set("Authorization", alice)
      .send({ path: "src/app.py", content: "print('hi')\n" });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ path: "/workspace/src/app.py", size: 12 });
    expect(vm.state.commands).toContain("/bin/mkdir -p /workspace/src");

    const get = await request(app).get(`/api/boxes/${id}/files?path=src/app.py`).set("Authorization", alice);
    expect(get.body.data).toMatchObject({ encoding: "utf8", content: "print('hi')\n", truncated: false });

    const missing = await request(app).get(`/api/boxes/${id}/files?path=nope.txt`).set("Authorization", alice);
    expect(missing.status).toBe(404);
  });

  it("keeps each user's boxes to that user, though both keys map to one tenant", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;

    const theirs = await request(app).post(`/api/boxes/${id}/exec`).set("Authorization", bob).send({ command: "echo hi" });
    expect(theirs.status).toBe(404);
    expect((await request(app).get(`/api/boxes/${id}`).set("Authorization", bob)).status).toBe(404);
    expect((await request(app).delete(`/api/boxes/${id}`).set("Authorization", bob)).status).toBe(404);
    expect((await request(app).get("/api/boxes").set("Authorization", bob)).body.data).toEqual([]);
    // Nor the tenant's admin key: it owns its own boxes, not its users'.
    expect((await request(app).get(`/api/boxes/${id}`).set("Authorization", ADMIN)).status).toBe(404);

    const mine = await request(app).get("/api/boxes").set("Authorization", alice);
    expect(mine.body.data.map((b: any) => b.box_id)).toEqual([id]);
  });

  it("stops a box, frees its slot, and starts it again on the next call", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;

    const stop = await request(app).post(`/api/boxes/${id}/stop`).set("Authorization", alice);
    expect(stop.body.data).toMatchObject({ status: "stopped", idle_stop_at: null });
    expect(vm.state.commands).toContain("/bin/sync");
    expect(vm.state.stopped).toContain(id);
    expect(await activeCount()).toBe(0);

    const again = await request(app).post(`/api/boxes/${id}/exec`).set("Authorization", alice).send({ command: "echo hi" });
    expect(again.body.data.stdout).toBe("hi\n");
    expect(vm.state.restarted).toContain(id);
    expect(await activeCount()).toBe(1);
    expect((await request(app).get(`/api/boxes/${id}`).set("Authorization", alice)).body.data.status).toBe("running");
  });

  it("reattaches with POST /api/boxes {box_id}", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;
    await request(app).post(`/api/boxes/${id}/stop`).set("Authorization", alice);

    const res = await request(app).post("/api/boxes").set("Authorization", alice).send({ box_id: id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ box_id: id, status: "running" });

    const notMine = await request(app).post("/api/boxes").set("Authorization", bob).send({ box_id: id });
    expect(notMine.status).toBe(404);
  });

  it("refuses a box past the tenant's limit", async () => {
    const limit = (await tenantService.getById("tenant_default"))!.max_concurrent_sandboxes;
    for (let i = 0; i < limit; i++) {
      expect((await request(app).post("/api/boxes").set("Authorization", alice)).status).toBe(201);
    }
    const over = await request(app).post("/api/boxes").set("Authorization", alice);
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/limit/i);
  });

  it("deletes a box with DELETE", async () => {
    const { body } = await request(app).post("/api/boxes").set("Authorization", alice);
    const id = body.data.box_id;
    const res = await request(app).delete(`/api/boxes/${id}`).set("Authorization", alice);
    expect(res.body.data).toEqual({ box_id: id, status: "removed" });
    expect(vm.state.removed).toContain(id);
    expect((await request(app).get(`/api/boxes/${id}`).set("Authorization", alice)).status).toBe(404);
    expect(await activeCount()).toBe(0);
  });

  it("stops boxes left idle, and leaves recent ones running", async () => {
    const a = (await request(app).post("/api/boxes").set("Authorization", alice)).body.data.box_id;
    const b = (await request(app).post("/api/boxes").set("Authorization", alice)).body.data.box_id;
    const longAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
    await db.update(boxes).set({ lastUsedAt: longAgo }).where(eq(boxes.id, a));

    await boxService.sweep();

    const [rowA] = await db.select().from(boxes).where(eq(boxes.id, a));
    const [rowB] = await db.select().from(boxes).where(eq(boxes.id, b));
    expect(rowA.status).toBe("stopped");
    expect(rowB.status).toBe("running");
    expect(await activeCount()).toBe(1);
  });
});
