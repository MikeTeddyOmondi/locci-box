import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export interface SandboxVolumePaths {
  /** rw, JuiceFS-backed — null when JFS_ENABLED=false */
  workspace: string | null;
  /** ro, shared datasets — null if dir not present */
  shared: string | null;
}

/**
 * VolumeService provisions per-run persistent workspaces backed by JuiceFS.
 * When JFS_ENABLED=false (default) every method is a no-op and SandboxService
 * falls back to a tmpfs /workspace — identical to the pre-JuiceFS behaviour.
 */
export class VolumeService {
  private readonly root: string;
  private readonly quotaMib: number;
  private readonly enabled: boolean;

  constructor() {
    this.root = env.JFS_ROOT;
    this.quotaMib = env.JFS_QUOTA_MIB;
    this.enabled = env.JFS_ENABLED;
  }

  /**
   * Provision host-side paths for a sandbox run.
   * Returns null paths when JuiceFS is disabled — SandboxService falls back to tmpfs.
   */
  async provision(
    userId: string,
    sandboxId: string,
  ): Promise<SandboxVolumePaths> {
    if (!this.enabled) {
      return { workspace: null, shared: null };
    }

    const workspacePath = join(this.root, "workspaces", userId, sandboxId);
    const sharedPath = join(this.root, "shared");

    try {
      await mkdir(workspacePath, { recursive: true });
      await this.setQuota(workspacePath);

      logger.info(
        { userId, sandboxId, workspacePath },
        "Provisioned JuiceFS workspace",
      );

      return {
        workspace: workspacePath,
        shared: existsSync(sharedPath) ? sharedPath : null,
      };
    } catch (err) {
      logger.warn(
        { err, workspacePath },
        "JuiceFS provision failed, falling back to tmpfs",
      );
      return { workspace: null, shared: null };
    }
  }

  /**
   * Remove a per-run workspace directory after TTL or explicit sandbox deletion.
   * The parent workspaces/<userId>/ directory is left intact.
   */
  async cleanup(userId: string, sandboxId: string): Promise<void> {
    if (!this.enabled) return;

    const workspacePath = join(this.root, "workspaces", userId, sandboxId);
    try {
      await rm(workspacePath, { recursive: true, force: true });
      logger.info({ userId, sandboxId }, "Cleaned up JuiceFS workspace");
    } catch (err) {
      logger.warn({ err, workspacePath }, "JuiceFS cleanup failed");
    }
  }

  /**
   * Returns used bytes for all of a user's workspaces.
   * Uses `du` against the FUSE mount (works inside the api container without the
   * juicefs binary). Feed into billing alongside compute duration.
   */
  async measureUsage(userId: string): Promise<number> {
    if (!this.enabled) return 0;

    const userPath = join(this.root, "workspaces", userId);
    if (!existsSync(userPath)) return 0;

    try {
      // `du -sk` reports 1024-byte blocks on both BSD (macOS) and GNU (Linux);
      // `-b` is GNU-only, so we convert from KiB for portability.
      const { stdout } = await execAsync(`du -sk ${userPath} 2>/dev/null`);
      const kib = parseInt(stdout.trim().split(/\s+/)[0] ?? "0", 10);
      return Number.isFinite(kib) ? kib * 1024 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Best-effort per-directory quota. No-ops when the juicefs binary is absent
   * (e.g. inside the api container) — community edition may also not support it.
   */
  private async setQuota(path: string): Promise<void> {
    const relative = path.replace(this.root + "/", "");
    try {
      await execAsync(
        `juicefs quota set ${this.root} --path ${relative} --capacity ${this.quotaMib} 2>/dev/null`,
      );
    } catch {
      // quota set is best-effort — ignore failures
    }
  }
}

export const volumeService = new VolumeService();

// Made with Bob
