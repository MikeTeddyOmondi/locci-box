import { nanoid } from "nanoid";
import { ExecTimeoutError, Image, ImageNotFoundError, Sandbox, NetworkPolicy } from "microsandbox";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";
import {
  SupportedLanguage,
  SandboxExecutionParams,
  SandboxResult,
  SandboxInfo,
  SandboxStatus,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { volumeService } from "./VolumeService.js";

/** How one language runs: its image, the file the code goes in, and the command that runs it. */
interface Runtime {
  /** Latest stable release, pinned to the minor version (patch updates come with a pull). */
  image: string;
  file: string;
  /** Compiles in /tmp/sandbox, where the code was written; its time does not count against the run's timeout. */
  build?: string;
  /** Runs in /tmp/sandbox, under the run's timeout. */
  run: string;
  /** Compilers need more than the 128 MB default. */
  memory?: number;
  env?: Record<string, string>;
}

/** Compiling has its own limit: on a busy host C++ took 79 s, past any run's timeout. */
const BUILD_TIMEOUT_MS = 120_000;

/**
 * Go builds its standard library into the build cache on first use: 4.6 s on
 * an M-series Mac, 280 s on thanos, per run. The API builds it once per Go
 * version into a host folder (181 MB) and mounts it read-only; each run links
 * it into its own writable cache (0.2 s), so no run can change what another
 * run reads.
 */
const GO_CACHE_MOUNT = "/opt/gocache";
const GO_CACHE_LINK = `{ cp -as ${GO_CACHE_MOUNT} /tmp/sandbox/.gocache 2>/dev/null || mkdir -p /tmp/sandbox/.gocache; }`;

/** The host folder with Go's prebuilt standard library for this image (one per Go version). */
export function goCacheDir(image: string = RUNTIMES.go.image): string {
  return resolve(env.RUNTIME_CACHE_ROOT, image.replace(/[^A-Za-z0-9.-]+/g, "_"));
}

// The gcc image sets GPG_KEYS and GCC_MIRRORS to lists with tabs in them, and
// microsandbox's VM builder panicked on them in 0.4.6 (InvalidAscii, SIGABRT at boot).
// They are only for building the image.
const GCC_ENV = { GPG_KEYS: "", GCC_MIRRORS: "" };

export const RUNTIMES: Record<SupportedLanguage, Runtime> = {
  python: { image: "docker.io/library/python:3.15-slim", file: "main.py", run: "python3 main.py" },
  node: { image: "docker.io/library/node:26-alpine", file: "main.js", run: "node main.js" },
  bash: { image: "docker.io/library/bash:5.3", file: "main.sh", run: "bash main.sh" },
  ruby: { image: "docker.io/library/ruby:4.0-alpine", file: "main.rb", run: "ruby main.rb" },
  go: {
    image: "docker.io/library/golang:1.27-alpine",
    file: "main.go",
    // The standard library comes prebuilt (GO_CACHE_MOUNT, see goCacheDir); GOTOOLCHAIN=local
    // keeps go from downloading another toolchain.
    build: `${GO_CACHE_LINK} && GOCACHE=/tmp/sandbox/.gocache GOTOOLCHAIN=local go build -o main main.go`,
    run: "./main",
    memory: 512,
  },
  rust: { image: "docker.io/library/rust:1.99-alpine", file: "main.rs", build: "rustc -o main main.rs", run: "./main", memory: 512 },
  c: { image: "docker.io/library/gcc:16.2", file: "main.c", build: "gcc -o main main.c -lm", run: "./main", memory: 256, env: GCC_ENV },
  cpp: {
    image: "docker.io/library/gcc:16.2",
    file: "main.cpp",
    build: "g++ -std=c++23 -o main main.cpp",
    run: "./main",
    memory: 256,
    env: GCC_ENV,
  },
};

/**
 * microsandbox's first pull of an image often fails with "Not authorized"
 * (measured: 1 to 2 tries, with Docker Hub's limit not reached); a retry gets
 * it. `create` must build a new SandboxBuilder each time: create() uses it up.
 */
export async function withPullRetry<T>(create: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create();
    } catch (error) {
      if (attempt >= 4 || !/Not authorized/i.test(String(error))) throw error;
      logger.warn({ attempt, error: String(error) }, "Image pull refused; retrying");
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * SandboxService wraps the microsandbox SDK with error handling,
 * logging, and resource management.
 */
export class SandboxService {
  // Track active sandboxes with their microsandbox instances
  private activeSandboxes: Map<
    string,
    { info: SandboxInfo; instance: Sandbox }
  > = new Map();
  /** Images warmImages() is still pulling; a run that needs one answers 503 meanwhile. */
  private pulling = new Set<string>();

  /** True while this language's image is being pulled at startup. */
  imagePending(language: string): boolean {
    const runtime = RUNTIMES[language as SupportedLanguage];
    return !!runtime && this.pulling.has(runtime.image);
  }

  /**
   * Pull the images this host has not cached, one at a time, smallest first.
   * A first pull can take longer than a client waits for its answer (Node 26
   * took over 5 minutes on thanos), so it happens at startup instead of in a
   * request. microsandbox has no pull on its own: a throwaway sandbox does it.
   */
  async warmImages(): Promise<void> {
    const missing: Runtime[] = [];
    const seen = new Set<string>();
    for (const runtime of Object.values(RUNTIMES)) {
      if (seen.has(runtime.image)) continue;
      seen.add(runtime.image);
      try {
        await Image.get(runtime.image);
      } catch (error) {
        if (error instanceof ImageNotFoundError) missing.push(runtime);
        else logger.warn({ image: runtime.image, error: String(error) }, "Checking a runtime image failed");
      }
    }
    for (const runtime of missing) this.pulling.add(runtime.image);
    for (const runtime of missing) {
      const name = `sbox-warmup-${nanoid(6)}`;
      const started = Date.now();
      logger.info({ image: runtime.image }, "Pulling a runtime image");
      try {
        const sandbox = await withPullRetry(() => {
          let builder = Sandbox.builder(name).image(runtime.image).memory(256).cpus(1).replace();
          for (const [key, value] of Object.entries(runtime.env ?? {})) builder = builder.env(key, value);
          return builder.create();
        });
        await sandbox.stopWithTimeout(15_000).catch(() => sandbox.kill().catch(() => {}));
        logger.info({ image: runtime.image, ms: Date.now() - started }, "Runtime image ready");
      } catch (error) {
        logger.error({ image: runtime.image, error: String(error) }, "Pulling a runtime image failed");
      } finally {
        // A failed pull is tried again by the next run in that language.
        this.pulling.delete(runtime.image);
        await Sandbox.remove(name).catch(() => {});
      }
    }
    await this.warmGoCache();
  }

  /** Build Go's standard library into goCacheDir() unless it is there already. */
  async warmGoCache(): Promise<void> {
    const dir = goCacheDir();
    if (existsSync(resolve(dir, ".ready"))) return;
    // Built beside the final folder and renamed when complete, so a run never mounts half a cache.
    const building = `${dir}.building`;
    rmSync(building, { recursive: true, force: true });
    mkdirSync(building, { recursive: true });
    const name = `sbox-gocache-${nanoid(6)}`;
    const started = Date.now();
    logger.info({ dir }, "Building Go's standard library cache");
    try {
      const sandbox = await withPullRetry(() =>
        Sandbox.builder(name)
          .image(RUNTIMES.go.image)
          .memory(1024)
          .cpus(2)
          .replace()
          .volume("/gocache", (m) => m.bind(building))
          .create(),
      );
      try {
        const result = await sandbox.execWith("/bin/sh", (b) =>
          b.args(["-c", "GOCACHE=/gocache GOTOOLCHAIN=local go build std"]).timeout(30 * 60_000),
        );
        if (result.code !== 0) throw new Error(result.stderr().slice(-500));
      } finally {
        await sandbox.stopWithTimeout(15_000).catch(() => sandbox.kill().catch(() => {}));
      }
      writeFileSync(resolve(building, ".ready"), new Date().toISOString());
      rmSync(dir, { recursive: true, force: true });
      renameSync(building, dir);
      logger.info({ dir, ms: Date.now() - started }, "Go standard library cache ready");
    } catch (error) {
      rmSync(building, { recursive: true, force: true });
      logger.error({ error: String(error) }, "Building Go's standard library cache failed; Go runs build it themselves");
    } finally {
      await Sandbox.remove(name).catch(() => {});
    }
  }

  /**
   * Execute code in a new microVM using microsandbox SDK
   */
  async execute(
    params: SandboxExecutionParams,
    tenantId: string,
  ): Promise<SandboxResult> {
    const sandboxId = `sbox_${nanoid(12)}`;
    const startTime = Date.now();

    logger.info(
      {
        sandbox_id: sandboxId,
        tenant_id: tenantId,
        language: params.language,
        timeout: params.timeout || 30,
      },
      "Creating microsandbox",
    );

    // Create sandbox info
    const sandboxInfo: SandboxInfo = {
      sandbox_id: sandboxId,
      tenant_id: tenantId,
      language: params.language,
      status: "running",
      created_at: new Date().toISOString(),
    };

    let sandbox: Sandbox | null = null;

    try {
      const runtime = RUNTIMES[params.language];
      if (!runtime) throw new Error(`Unsupported language: ${params.language}`);
      const imageName = runtime.image;

      logger.debug(
        { sandbox_id: sandboxId, image: imageName },
        "Building microsandbox with image",
      );

      const timeoutMs = (params.timeout || 30) * 1000;
      // Provision persistent workspace (no-op tmpfs fallback when JFS_ENABLED=false)
      const volumes = await volumeService.provision(tenantId, sandboxId);

      // A builder is used up by create(), so a retried pull needs a new one.
      const makeBuilder = () => {
        let builder = Sandbox.builder(sandboxId)
          .image(imageName)
          // A backstop if the API dies mid-run: the VM stops itself.
          .maxDuration(Math.ceil((timeoutMs + BUILD_TIMEOUT_MS) / 1000) + 60)
          .cpus(params.cpu || 1)
          .memory(Math.max(params.memory || 128, runtime.memory ?? 128)) // MB
          // Allowlist: deny all egress by default, allow DNS + known package registries on 443.
          // This prevents VPS origin IP exposure via outbound traffic while still allowing installs.
          .network((n) => n.policy(
            NetworkPolicy.builder()
              .defaultDeny()
              .egress((e) => e.udp().port(53).allow((d) => d.any()))  // DNS resolution
              .egress((e) => e.tcp().port(53).allow((d) => d.any()))  // DNS over TCP fallback
              .egress((e) =>
                e.tcp().port(443)
                  .allow((d) => d.domain("pypi.org"))
                  .allow((d) => d.domainSuffix("pypi.org"))
                  .allow((d) => d.domain("files.pythonhosted.org"))
                  .allow((d) => d.domain("registry.npmjs.org"))
                  .allow((d) => d.domainSuffix("npmjs.org"))
                  .allow((d) => d.domainSuffix("alpinelinux.org"))
              )
              .build()
          ));

        for (const [key, value] of Object.entries(runtime.env ?? {})) {
          builder = builder.env(key, value);
        }
        // Add environment variables if provided
        if (params.env) {
          for (const [key, value] of Object.entries(params.env)) {
            builder = builder.env(key, value);
          }
        }

        // /workspace: JuiceFS bind when available, tmpfs fallback otherwise
        if (volumes.workspace) {
          builder = builder.volume("/workspace", (m) =>
            m.bind(volumes.workspace!),
          );
        } else {
          builder = builder.volume("/workspace", (m) => m.tmpfs().size(512));
        }

        // /shared: read-only shared datasets, only when the directory exists
        if (volumes.shared) {
          builder = builder.volume("/shared", (m) =>
            m.bind(volumes.shared!).readonly(),
          );
        }

        // /tmp/sandbox: always ephemeral tmpfs scratch, zero cleanup cost
        builder = builder.volume("/tmp/sandbox", (m) => m.tmpfs().size(256));
        if (params.language === "go" && existsSync(resolve(goCacheDir(), ".ready"))) {
          builder = builder.volume(GO_CACHE_MOUNT, (m) => m.bind(goCacheDir()).readonly());
        }
        return builder;
      };

      sandbox = await withPullRetry(() => makeBuilder().create());

      logger.debug(
        { sandbox_id: sandboxId },
        "Microsandbox created successfully",
      );

      // Track the sandbox
      this.activeSandboxes.set(sandboxId, {
        info: sandboxInfo,
        instance: sandbox,
      });

      // Execute code using the appropriate method for each language
      logger.debug(
        { sandbox_id: sandboxId, language: params.language },
        "Executing code in microsandbox",
      );

      // The code goes in a file, not an argument: compilers need one, and
      // an argument is capped at 128 KB by the kernel.
      await sandbox.fs().write(`/tmp/sandbox/${runtime.file}`, Buffer.from(params.code));
      const live = sandbox;
      const sh = (script: string, ms: number) =>
        live.execWith("/bin/sh", (b) => b.args(["-c", `cd /tmp/sandbox && ${script}`]).timeout(ms));
      let result: { code: number; stdout: () => string; stderr: () => string };
      let status: SandboxStatus = "completed";
      let phase: "build" | "run" = "build";
      try {
        const built = runtime.build ? await sh(runtime.build, BUILD_TIMEOUT_MS) : null;
        phase = "run";
        // A failed compile is the answer: its errors, its exit code.
        result = built && built.code !== 0 ? built : await sh(runtime.run, timeoutMs);
      } catch (error) {
        if (!(error instanceof ExecTimeoutError)) throw error;
        status = "timeout";
        const stopped =
          phase === "build"
            ? `Compiling stopped after ${BUILD_TIMEOUT_MS / 1000} s.`
            : `Stopped after ${Math.round(timeoutMs / 1000)} s (the run's time limit).`;
        result = { code: 124, stdout: () => "", stderr: () => stopped };
      }

      const duration = Date.now() - startTime;

      // Determine status based on exit code
      if (status !== "timeout" && result.code !== 0) {
        status = "failed";
      }

      logger.info(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          status,
          duration_ms: duration,
          exit_code: result.code,
        },
        "Microsandbox execution completed",
      );

      // Clean up sandbox
      await this.cleanupSandbox(sandboxId);

      return {
        sandbox_id: sandboxId,
        status,
        stdout: result.stdout(),
        stderr: result.stderr(),
        exit_code: result.code,
        duration_ms: duration,
        created_at: sandboxInfo.created_at,
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Determine if it's a timeout error
      const isTimeout =
        error instanceof Error &&
        (error.message.includes("timeout") ||
          error.message.includes("timed out") ||
          error.message.includes("ExecTimeoutError"));

      const status: SandboxStatus = isTimeout ? "timeout" : "failed";

      logger.error(
        {
          sandbox_id: sandboxId,
          tenant_id: tenantId,
          error: error instanceof Error ? error.message : "Unknown error",
          error_name:
            error instanceof Error ? error.constructor.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
          duration_ms: duration,
          status,
        },
        "Microsandbox execution failed",
      );

      // Clean up sandbox on error
      await this.cleanupSandbox(sandboxId);

      return {
        sandbox_id: sandboxId,
        status,
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unknown error",
        exit_code: 1,
        duration_ms: duration,
        created_at: sandboxInfo.created_at,
        completed_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get status of a running sandbox
   */
  async getStatus(sandboxId: string): Promise<SandboxInfo | null> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      return null;
    }

    // Calculate uptime
    const createdAt = new Date(sandboxData.info.created_at).getTime();
    const uptime = Date.now() - createdAt;

    return {
      ...sandboxData.info,
      uptime_ms: uptime,
    };
  }

  /**
   * Stop a running sandbox
   */
  async stop(sandboxId: string): Promise<void> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      throw new Error("Sandbox not found or already stopped");
    }

    logger.info({ sandbox_id: sandboxId }, "Stopping microsandbox");

    const timeout = (ms: number) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms),
      );

    try {
      await Promise.race([sandboxData.instance.stop(), timeout(5000)]);
      logger.debug({ sandbox_id: sandboxId }, "Microsandbox stopped successfully");
    } catch (stopErr) {
      logger.warn(
        { sandbox_id: sandboxId, error: stopErr instanceof Error ? stopErr.message : stopErr },
        "Stop timed out or failed, attempting kill",
      );
      try {
        await Promise.race([sandboxData.instance.kill(), timeout(5000)]);
      } catch (killErr) {
        logger.error(
          { sandbox_id: sandboxId, error: killErr instanceof Error ? killErr.message : killErr },
          "Kill also timed out — forcing removal from tracking",
        );
      }
    }

    // Remove the per-run JuiceFS workspace (no-op when JFS_ENABLED=false)
    await volumeService.cleanup(sandboxData.info.tenant_id, sandboxId);

    // Always remove from tracking regardless of stop/kill outcome
    this.activeSandboxes.delete(sandboxId);
    logger.info({ sandbox_id: sandboxId }, "Microsandbox stopped");
  }

  /**
   * List all active sandboxes for a tenant
   */
  async listActive(tenantId: string): Promise<SandboxInfo[]> {
    const sandboxes: SandboxInfo[] = [];
    for (const sandboxData of Array.from(this.activeSandboxes.values())) {
      if (sandboxData.info.tenant_id === tenantId) {
        sandboxes.push(sandboxData.info);
      }
    }
    return sandboxes;
  }

  /**
   * Clean up stale sandboxes (called by cron or manually)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [sandboxId, sandboxData] of Array.from(
      this.activeSandboxes.entries(),
    )) {
      const createdAt = new Date(sandboxData.info.created_at).getTime();
      if (now - createdAt > maxAge) {
        logger.warn(
          { sandbox_id: sandboxId },
          "Cleaning up stale microsandbox",
        );

        try {
          await sandboxData.instance.kill();
        } catch (error) {
          logger.error(
            {
              sandbox_id: sandboxId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Error killing stale microsandbox",
          );
        }

        this.activeSandboxes.delete(sandboxId);
      }
    }
  }

  /**
   * Clean up a specific sandbox
   */
  private async cleanupSandbox(sandboxId: string): Promise<void> {
    const sandboxData = this.activeSandboxes.get(sandboxId);
    if (!sandboxData) {
      return;
    }

    // Remove the per-run JuiceFS workspace (no-op when JFS_ENABLED=false)
    await volumeService.cleanup(sandboxData.info.tenant_id, sandboxId);

    try {
      // Try graceful stop first (bounded: stop() alone waits for as long as it takes)
      await sandboxData.instance.stopWithTimeout(10_000);
      logger.debug(
        { sandbox_id: sandboxId },
        "Microsandbox cleaned up gracefully",
      );
    } catch (error) {
      // If stop fails, force kill
      try {
        await sandboxData.instance.kill();
        logger.debug(
          { sandbox_id: sandboxId },
          "Microsandbox force killed during cleanup",
        );
      } catch (killError) {
        logger.warn(
          {
            sandbox_id: sandboxId,
            error:
              killError instanceof Error ? killError.message : "Unknown error",
          },
          "Error during microsandbox cleanup",
        );
      }
    }

    this.activeSandboxes.delete(sandboxId);
    // A run is never resumed: delete its VM and disk, or every run stays in
    // ~/.microsandbox/sandboxes (about 120 piled up on a dev Mac). A stop can
    // still be finishing, so retry briefly.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        await Sandbox.remove(sandboxId);
        return;
      } catch (error) {
        if (!/still running|StillRunning/i.test(String(error))) return;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}

// Singleton instance
export const sandboxService = new SandboxService();

// Made with Bob
