import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { posix } from "node:path";
import {
  ExecTimeoutError,
  Image,
  ImageNotFoundError,
  NetworkPolicy,
  Sandbox,
  SandboxNotFoundError,
  SandboxStillRunningError,
} from "microsandbox";
import { db } from "../db/index.js";
import { boxes } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { tenantService } from "./TenantService.js";
import { volumeService } from "./VolumeService.js";
import { withPullRetry } from "./SandboxService.js";

/**
 * Agent boxes: a microVM an AI works in the way a person works in a VM. Unlike
 * run_sandbox (one snippet, then gone), a box keeps running between calls, has
 * room to work (BOX_MEMORY_MIB, a Debian image with apt, git, curl, build tools,
 * Python and Node) and open egress with the host's networks blocked.
 *
 * A box stops after BOX_IDLE_MINUTES without a call, or BOX_MAX_HOURS after it
 * started. Its row stays: a later call with the same id starts it again with
 * its disk as it was (apt installs included; measured) and the same /workspace,
 * so a chat thread can keep one box id for its whole life.
 */

const WORKDIR = "/workspace";
/** Output kept per stream; the end is kept, where errors are. */
const MAX_OUTPUT_CHARS = 100_000;
const MAX_READ_BYTES = 1024 * 1024;
const MAX_WRITE_BYTES = 5 * 1024 * 1024;
const STOP_WAIT_MS = 15_000;

export interface BoxOwner {
  tenantId: string;
  /** The user behind the key or token; the tenant id for a tenant key. */
  ownerId: string;
}

export type BoxStatus = "running" | "stopped";

export interface BoxInfo {
  box_id: string;
  status: BoxStatus;
  image: string;
  memory_mib: number;
  workdir: string;
  created_at: string;
  started_at: string;
  last_used_at: string;
  stopped_at: string | null;
  /** When an idle running box will be stopped, unless it is used before. */
  idle_stop_at: string | null;
}

export interface BoxExecResult {
  box_id: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
  /** Output beyond MAX_OUTPUT_CHARS was cut from the start of a stream. */
  truncated: boolean;
}

export interface BoxFile {
  box_id: string;
  path: string;
  size: number;
  encoding: "utf8" | "base64";
  content: string;
  truncated: boolean;
}

/** A failure the caller caused or can act on, with the HTTP status that says so. */
export class BoxError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413 | 429 | 500 | 503,
  ) {
    super(message);
    this.name = "BoxError";
  }
}

type BoxRow = typeof boxes.$inferSelect;

/**
 * Egress for boxes: DNS to microsandbox's resolver, then the host's own
 * networks refused (private, CGNAT, loopback, link-local with cloud metadata,
 * multicast, the host itself, and their IPv6 equivalents), then the public
 * internet. First match wins, so DNS has to come before the denies: the
 * resolver sits at a CGNAT address. run_sandbox keeps its allowlist.
 */
export function boxNetworkPolicy() {
  return NetworkPolicy.builder()
    .defaultDeny()
    .egress((e) => e.udp().tcp().port(53).allowHost())
    .egress((e) =>
      e
        .denyPrivate()
        .denyLoopback()
        .denyLinkLocal()
        .denyMeta()
        .denyMulticast()
        .denyHost()
        // Not all of these are in the groups above; listed so the rule does not
        // depend on how microsandbox defines them.
        .deny((d) => d.cidr("0.0.0.0/8"))
        .deny((d) => d.cidr("10.0.0.0/8"))
        .deny((d) => d.cidr("100.64.0.0/10"))
        .deny((d) => d.cidr("127.0.0.0/8"))
        .deny((d) => d.cidr("169.254.0.0/16"))
        .deny((d) => d.cidr("172.16.0.0/12"))
        .deny((d) => d.cidr("192.168.0.0/16"))
        .deny((d) => d.cidr("198.18.0.0/15"))
        .deny((d) => d.cidr("::1/128"))
        .deny((d) => d.cidr("fc00::/7"))
        .deny((d) => d.cidr("fe80::/10")),
    )
    .egress((e) => e.allowPublic());
}

/** A guest path for a caller's path: relative ones are under /workspace. */
export function guestPath(path: string): string {
  if (!path || typeof path !== "string") throw new BoxError("path is required", 400);
  return posix.resolve(WORKDIR, path);
}

/** Keep the end of a long stream. */
function tailOf(text: string): { text: string; cut: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { text, cut: false };
  return { text: `[... output cut]\n${text.slice(-MAX_OUTPUT_CHARS)}`, cut: true };
}

const now = () => new Date().toISOString();

export class BoxService {
  /** Running microVMs this process holds, by box id. */
  private live = new Map<string, Sandbox>();
  /** Starts in flight, so two calls on a stopped box start it once. */
  private starting = new Map<string, Promise<Sandbox>>();
  /** Calls in flight per box; the idle sweep leaves a busy box alone. */
  private busy = new Map<string, number>();
  private sweeper: NodeJS.Timeout | null = null;
  /** False while warmImage() is pulling BOX_IMAGE into microsandbox's cache. */
  private imageReady = true;

  /**
   * Pull BOX_IMAGE when this host has not cached it. The first pull is minutes
   * (about 1 GB; measured on thanos), longer than a client waits for a create,
   * so it happens at startup and creates answer 503 until it is done.
   * microsandbox has no pull on its own, so a throwaway sandbox does it.
   */
  async warmImage(): Promise<void> {
    try {
      await Image.get(env.BOX_IMAGE);
      return;
    } catch (error) {
      if (!(error instanceof ImageNotFoundError)) {
        logger.warn({ error: String(error) }, "Checking the box image failed");
        return;
      }
    }
    this.imageReady = false;
    const name = `box-warmup-${nanoid(6)}`;
    const t0 = Date.now();
    logger.info({ image: env.BOX_IMAGE }, "Pulling the box image");
    try {
      const sandbox = await withPullRetry(() =>
        Sandbox.builder(name).image(env.BOX_IMAGE).memory(256).cpus(1).replace().detached(true).create(),
      );
      await sandbox.stopWithTimeout(STOP_WAIT_MS).catch(() => sandbox.kill().catch(() => {}));
      logger.info({ image: env.BOX_IMAGE, ms: Date.now() - t0 }, "Box image ready");
    } catch (error) {
      logger.error({ image: env.BOX_IMAGE, error: String(error) }, "Pulling the box image failed");
    } finally {
      // A failed pull is retried by the next create, which then reports the error.
      this.imageReady = true;
      await this.removeVm(name);
    }
  }

  /** Create a box, or with `boxId`, reattach to one the caller owns (starting it if stopped). */
  async create(owner: BoxOwner, boxId?: string): Promise<BoxInfo> {
    if (boxId) {
      await this.ensureRunning(owner, boxId);
      return this.info(await this.row(owner, boxId));
    }

    this.assertImageReady();
    await this.reserve(owner.tenantId);
    const id = `box_${nanoid(12)}`;
    try {
      const workspacePath = await volumeService.provisionBox(owner.ownerId, id);
      const at = now();
      await db.insert(boxes).values({
        id,
        tenantId: owner.tenantId,
        ownerId: owner.ownerId,
        status: "running",
        image: env.BOX_IMAGE,
        memoryMib: env.BOX_MEMORY_MIB,
        workspacePath,
        createdAt: at,
        startedAt: at,
        lastUsedAt: at,
      });
      const row = await this.row(owner, id);
      await this.boot(row, true);
      logger.info({ box_id: id, tenant_id: owner.tenantId }, "Box created");
      return this.info(await this.row(owner, id));
    } catch (error) {
      await tenantService.decrementActive(owner.tenantId);
      await db.delete(boxes).where(eq(boxes.id, id));
      await volumeService.removeBox(owner.ownerId, id);
      throw error;
    }
  }

  /** Run a shell command in the box, in /workspace unless it `cd`s elsewhere. */
  async exec(
    owner: BoxOwner,
    boxId: string,
    command: string,
    timeoutSeconds?: number,
  ): Promise<BoxExecResult> {
    if (!command || typeof command !== "string") throw new BoxError("command is required", 400);
    const timeout = Math.min(
      Math.max(1, Math.round(timeoutSeconds ?? env.BOX_EXEC_TIMEOUT_SECONDS)),
      env.BOX_EXEC_MAX_SECONDS,
    );
    return this.using(owner, boxId, async (sandbox) => {
      const started = Date.now();
      try {
        const out = await sandbox.execWith("/bin/sh", (b) =>
          b.args(["-c", command]).cwd(WORKDIR).timeout(timeout * 1000),
        );
        const stdout = tailOf(out.stdout());
        const stderr = tailOf(out.stderr());
        return {
          box_id: boxId,
          exit_code: out.code,
          stdout: stdout.text,
          stderr: stderr.text,
          duration_ms: Date.now() - started,
          timed_out: false,
          truncated: stdout.cut || stderr.cut,
        };
      } catch (error) {
        if (!(error instanceof ExecTimeoutError)) throw error;
        return {
          box_id: boxId,
          exit_code: 124, // what timeout(1) exits with
          stdout: "",
          stderr: `Stopped after ${timeout} s (the command's timeout). Run long jobs in the background (nohup ... &) and check on them.`,
          duration_ms: Date.now() - started,
          timed_out: true,
          truncated: false,
        };
      }
    });
  }

  async writeFile(
    owner: BoxOwner,
    boxId: string,
    path: string,
    content: string,
    encoding: "utf8" | "base64" = "utf8",
  ): Promise<{ box_id: string; path: string; size: number }> {
    const target = guestPath(path);
    if (typeof content !== "string") throw new BoxError("content is required", 400);
    const data = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
    if (data.length > MAX_WRITE_BYTES) {
      throw new BoxError(`File too large: ${data.length} bytes (limit ${MAX_WRITE_BYTES})`, 413);
    }
    return this.using(owner, boxId, async (sandbox) => {
      await sandbox.execWith("/bin/mkdir", (b) => b.args(["-p", posix.dirname(target)]).timeout(10_000));
      await sandbox.fs().write(target, data);
      return { box_id: boxId, path: target, size: data.length };
    });
  }

  async readFile(owner: BoxOwner, boxId: string, path: string): Promise<BoxFile> {
    const target = guestPath(path);
    return this.using(owner, boxId, async (sandbox) => {
      const fs = sandbox.fs();
      if (!(await fs.exists(target))) throw new BoxError(`No such file: ${target}`, 404);
      const meta = await fs.stat(target);
      if (meta.kind === "directory") throw new BoxError(`${target} is a directory`, 400);
      const bytes = Buffer.from(await fs.read(target));
      const kept = bytes.subarray(0, MAX_READ_BYTES);
      // NUL bytes mean binary: send it as base64 rather than mangled text.
      const binary = kept.includes(0);
      return {
        box_id: boxId,
        path: target,
        size: bytes.length,
        encoding: binary ? "base64" : "utf8",
        content: binary ? kept.toString("base64") : kept.toString("utf8"),
        truncated: bytes.length > MAX_READ_BYTES,
      };
    });
  }

  /** Stop a box. Its disk and /workspace are kept unless `remove`, which deletes the box. */
  async stop(owner: BoxOwner, boxId: string, remove = false): Promise<BoxInfo | null> {
    const row = await this.row(owner, boxId);
    await this.halt(row, remove ? "removed" : "stopped by the caller");
    if (!remove) return this.info(await this.row(owner, boxId));
    await this.removeVm(boxId);
    await volumeService.removeBox(row.ownerId, boxId);
    await db.delete(boxes).where(eq(boxes.id, boxId));
    logger.info({ box_id: boxId }, "Box removed");
    return null;
  }

  async list(owner: BoxOwner): Promise<BoxInfo[]> {
    const rows = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.tenantId, owner.tenantId), eq(boxes.ownerId, owner.ownerId)));
    return rows.map((r) => this.info(r));
  }

  async get(owner: BoxOwner, boxId: string): Promise<BoxInfo> {
    return this.info(await this.row(owner, boxId));
  }

  /** Stop boxes idle past BOX_IDLE_MINUTES or running past BOX_MAX_HOURS. */
  async sweep(at = Date.now()): Promise<void> {
    const running = await db.select().from(boxes).where(eq(boxes.status, "running"));
    for (const row of running) {
      if (this.busy.get(row.id)) continue;
      const idle = at - Date.parse(row.lastUsedAt) > env.BOX_IDLE_MINUTES * 60_000;
      const old = at - Date.parse(row.startedAt) > env.BOX_MAX_HOURS * 3_600_000;
      if (idle || old) await this.halt(row, idle ? "idle" : "max duration");
    }
  }

  /**
   * After an API restart: reconnect to boxes whose microVM kept running
   * (they are started detached), and mark the rest stopped.
   */
  async reconcile(): Promise<void> {
    const running = await db.select().from(boxes).where(eq(boxes.status, "running"));
    for (const row of running) {
      try {
        const handle = await Sandbox.get(row.id);
        if (handle.status === "running") {
          this.live.set(row.id, await handle.connect());
          logger.info({ box_id: row.id }, "Reconnected to box");
          continue;
        }
      } catch {
        // gone: fall through
      }
      await this.markStopped(row);
    }
  }

  startSweeper(intervalMs = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      this.sweep().catch((error) => logger.error({ error: String(error) }, "Box sweep failed"));
    }, intervalMs);
    this.sweeper.unref();
  }

  stopSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  // -- internals --------------------------------------------------------------

  /** The caller's box. Another owner's box is "not found", like a missing one. */
  private async row(owner: BoxOwner, boxId: string): Promise<BoxRow> {
    if (!boxId || typeof boxId !== "string") throw new BoxError("box_id is required", 400);
    const [row] = await db.select().from(boxes).where(eq(boxes.id, boxId));
    if (!row || row.tenantId !== owner.tenantId || row.ownerId !== owner.ownerId) {
      throw new BoxError(`Box ${boxId} not found`, 404);
    }
    return row;
  }

  private assertImageReady(): void {
    if (!this.imageReady) {
      throw new BoxError("The box image is still downloading on this host; retry in a minute", 503);
    }
  }

  /** Count a box against the tenant's sandbox limit, as run_sandbox does. */
  private async reserve(tenantId: string): Promise<void> {
    if (!(await tenantService.canCreateSandbox(tenantId))) {
      throw new BoxError("Sandbox limit reached for this tenant: stop a box or wait for a run to finish", 429);
    }
    await tenantService.incrementActive(tenantId);
  }

  /** Run `fn` against the box's microVM, starting it first if it was stopped. */
  private async using<T>(owner: BoxOwner, boxId: string, fn: (sandbox: Sandbox) => Promise<T>): Promise<T> {
    this.busy.set(boxId, (this.busy.get(boxId) ?? 0) + 1);
    try {
      const sandbox = await this.ensureRunning(owner, boxId);
      await db.update(boxes).set({ lastUsedAt: now() }).where(eq(boxes.id, boxId));
      return await fn(sandbox);
    } finally {
      const n = (this.busy.get(boxId) ?? 1) - 1;
      if (n > 0) this.busy.set(boxId, n);
      else this.busy.delete(boxId);
      await db.update(boxes).set({ lastUsedAt: now() }).where(eq(boxes.id, boxId)).catch(() => {});
    }
  }

  private async ensureRunning(owner: BoxOwner, boxId: string): Promise<Sandbox> {
    const row = await this.row(owner, boxId);
    const held = this.live.get(boxId);
    if (row.status === "running" && held) return held;

    const pending = this.starting.get(boxId);
    if (pending) return pending;

    const start = (async () => {
      if (row.status === "stopped") await this.reserve(row.tenantId);
      try {
        const at = now();
        await db
          .update(boxes)
          .set({ status: "running", startedAt: at, lastUsedAt: at, stoppedAt: null })
          .where(eq(boxes.id, boxId));
        return await this.boot(row, false);
      } catch (error) {
        await db.update(boxes).set({ status: "stopped", stoppedAt: now() }).where(eq(boxes.id, boxId));
        await tenantService.decrementActive(row.tenantId);
        throw error;
      }
    })();
    this.starting.set(boxId, start);
    try {
      return await start;
    } finally {
      this.starting.delete(boxId);
    }
  }

  /**
   * Start the microVM: a fresh one, or the stopped one again (its disk as it
   * was). If the old one is gone (another host, or removed), a fresh one gets
   * the same /workspace, so files there survive even then.
   */
  private async boot(row: BoxRow, fresh: boolean): Promise<Sandbox> {
    let sandbox: Sandbox | null = null;
    if (!fresh) {
      try {
        // Still running (held by an earlier API process): connect rather than restart.
        const handle = await Sandbox.get(row.id);
        sandbox = handle.status === "running" ? await handle.connect() : await Sandbox.startDetached(row.id);
        logger.info({ box_id: row.id }, "Box restarted");
      } catch (error) {
        logger.warn(
          { box_id: row.id, error: String(error) },
          "Restarting the box's microVM failed; booting a fresh one on the same workspace",
        );
      }
    }
    if (!sandbox) {
      this.assertImageReady();
      const workspace = row.workspacePath ?? (await volumeService.provisionBox(row.ownerId, row.id));
      const makeBuilder = () =>
        Sandbox.builder(row.id)
        .image(row.image)
        .memory(row.memoryMib)
        .cpus(env.BOX_CPUS)
        .workdir(WORKDIR)
        .replace()
        // A backstop for an API that died without stopping it; the sweep normally stops it first.
        .maxDuration(env.BOX_MAX_HOURS * 3600 + 600)
        .volume(WORKDIR, (m) => m.bind(workspace))
        // policyFromBuilder: in 0.4.6 the JSON route (`.policy()`) sent
        // "link-local", which microsandbox's own parser rejected.
        .network((n) => n.policyFromBuilder(boxNetworkPolicy()))
        // Detached: the VM outlives this API process (reattached after a restart).
        .detached(true);
      sandbox = await withPullRetry(() => makeBuilder().create());
    }
    this.live.set(row.id, sandbox);
    return sandbox;
  }

  /** Stop the microVM, flushing its disk first so a restart finds every write. */
  private async halt(row: BoxRow, reason: string): Promise<void> {
    const sandbox = this.live.get(row.id);
    this.live.delete(row.id);
    if (sandbox) {
      // Without sync, writes from the last seconds were lost on restart (measured).
      await sandbox.execWith("/bin/sync", (b) => b.timeout(10_000)).catch(() => {});
      // stopWithTimeout throws at the deadline without killing; then kill.
      await sandbox.stopWithTimeout(STOP_WAIT_MS).catch(() => sandbox.kill().catch(() => {}));
    } else if (row.status === "running") {
      // Held by an earlier API process: stop it by name.
      await Sandbox.get(row.id)
        .then((h) => h.stopWithTimeout(STOP_WAIT_MS).catch(() => h.kill()))
        .catch((error) => {
          if (!(error instanceof SandboxNotFoundError)) {
            logger.warn({ box_id: row.id, error: String(error) }, "Stopping a box by name failed");
          }
        });
    }
    await this.markStopped(row);
    logger.info({ box_id: row.id, reason }, "Box stopped");
  }

  /**
   * Delete the microVM and its disk. A stop can still be finishing (seen with a
   * box reconnected after an API restart), so retry for a while, then kill it.
   */
  private async removeVm(boxId: string): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await Sandbox.remove(boxId);
        return;
      } catch (error) {
        if (error instanceof SandboxNotFoundError) return;
        if (!(error instanceof SandboxStillRunningError)) {
          logger.warn({ box_id: boxId, error: String(error) }, "Removing the box's microVM failed");
          return;
        }
        if (attempt === 10) await Sandbox.get(boxId).then((h) => h.kill()).catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    logger.warn({ box_id: boxId }, "The box's microVM was still running after 15 s; not removed");
  }

  private async markStopped(row: BoxRow): Promise<void> {
    if (row.status !== "running") return;
    await db.update(boxes).set({ status: "stopped", stoppedAt: now() }).where(eq(boxes.id, row.id));
    await tenantService.decrementActive(row.tenantId);
    row.status = "stopped";
  }

  private info(row: BoxRow): BoxInfo {
    const running = row.status === "running";
    return {
      box_id: row.id,
      status: row.status as BoxStatus,
      image: row.image,
      memory_mib: row.memoryMib,
      workdir: WORKDIR,
      created_at: row.createdAt,
      started_at: row.startedAt,
      last_used_at: row.lastUsedAt,
      stopped_at: row.stoppedAt,
      idle_stop_at: running
        ? new Date(Date.parse(row.lastUsedAt) + env.BOX_IDLE_MINUTES * 60_000).toISOString()
        : null,
    };
  }
}

export const boxService = new BoxService();
