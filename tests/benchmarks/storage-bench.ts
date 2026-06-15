/**
 * Storage benchmark: normal storage (tmpfs) vs JuiceFS.
 *
 * Measures two distinct layers for each storage backend, using the microsandbox
 * SDK's own instrumentation (`sandbox.metrics()`):
 *
 *   1. Host<->guest transfer  — fs().copyFromHost() (upload) / copyToHost() (download)
 *   2. In-sandbox raw I/O      — `dd` write/read against /workspace
 *
 * It is intentionally self-contained (no imports from ../src) so it can be
 * `docker cp`-ed into the running api container and executed with the bundled
 * `tsx`/`node_modules` even though that image only ships `dist/`.
 *
 * Run:
 *   pnpm bench:storage                          # local, tmpfs only (juicefs likely unavailable)
 *   MODES=tmpfs,juicefs SIZES_MIB=1,10,100 ITERS=5 pnpm bench:storage
 *
 * Inside the thanos api container (rootless self-mounted JuiceFS at /mnt/locci-box):
 *   docker compose exec api node_modules/.bin/tsx /tmp/storage-bench.ts
 *
 * Output: a Markdown report to stdout (capture and fold into docs/BENCHMARKS.md).
 */

import { Sandbox } from "microsandbox";
import { mkdir, rm, mkdtemp, stat } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ── Config (env-overridable) ────────────────────────────────────────────────
const SIZES_MIB = (process.env.SIZES_MIB ?? "1,10,100")
  .split(",")
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const ITERS = Math.max(2, parseInt(process.env.ITERS ?? "5", 10));
const MODES = (process.env.MODES ?? "tmpfs,juicefs")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as StorageMode[];
const JFS_ROOT = process.env.JFS_ROOT ?? "/mnt/locci-box";
// Drop the guest page cache before the in-sandbox read so it isn't served warm from
// the just-completed write. NOTE: this clears the guest kernel cache only; the JuiceFS
// client cache in the api container is not cleared, so cold-storage (S3) reads would be
// at or below these figures. Best-effort — needs root in the guest.
const COLD_READ = (process.env.COLD_READ ?? "false") === "true";
const TENANT = process.env.BENCH_TENANT ?? "bench";
const IMAGE = process.env.BENCH_IMAGE ?? "python:3.11-slim";
const WORKSPACE_TMPFS_MIB = parseInt(process.env.WORKSPACE_TMPFS_MIB ?? "512", 10);

const MIB = 1024 * 1024;

type StorageMode = "tmpfs" | "juicefs";
type Op = "upload" | "write" | "read" | "download";
const OPS: Op[] = ["upload", "write", "read", "download"];

interface MetricsSnapshot {
  cpuPercent?: number;
  memoryBytes?: number;
  diskReadBytes?: number;
  diskWriteBytes?: number;
  netRxBytes?: number;
  netTxBytes?: number;
  uptimeMs?: number;
}

interface Sample {
  mode: StorageMode;
  sizeMiB: number;
  op: Op;
  seconds: number;
  mibPerSec: number;
  diskWriteDelta?: number;
  diskReadDelta?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function now(): number {
  return Number(process.hrtime.bigint()) / 1e9;
}

/** Write a file of `sizeMiB` MiB to host disk in 1 MiB chunks (no huge alloc). */
async function makeHostFile(path: string, sizeMiB: number): Promise<void> {
  const chunk = randomBytes(MIB);
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(path);
    ws.on("error", reject);
    ws.on("finish", resolve);
    let i = 0;
    const writeNext = () => {
      let ok = true;
      while (i < sizeMiB && ok) {
        i++;
        ok = ws.write(chunk);
      }
      if (i >= sizeMiB) ws.end();
      else ws.once("drain", writeNext);
    };
    writeNext();
  });
}

async function snapshot(sandbox: Sandbox): Promise<MetricsSnapshot> {
  try {
    const m = (await sandbox.metrics()) as unknown as MetricsSnapshot;
    return {
      cpuPercent: m.cpuPercent,
      memoryBytes: m.memoryBytes,
      diskReadBytes: m.diskReadBytes,
      diskWriteBytes: m.diskWriteBytes,
      netRxBytes: m.netRxBytes,
      netTxBytes: m.netTxBytes,
      uptimeMs: m.uptimeMs,
    };
  } catch {
    return {};
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Probe whether JuiceFS workspace root is usable (rootless self-mount inside api). */
async function juicefsAvailable(): Promise<{ ok: boolean; reason: string }> {
  const probeDir = join(JFS_ROOT, "workspaces", TENANT, `.probe-${Date.now()}`);
  try {
    await mkdir(probeDir, { recursive: true });
    await rm(probeDir, { recursive: true, force: true });
    return { ok: true, reason: `${JFS_ROOT} writable` };
  } catch (err) {
    return {
      ok: false,
      reason: `${JFS_ROOT} not writable (${(err as Error).message})`,
    };
  }
}

// ── Core benchmark ──────────────────────────────────────────────────────────

async function buildSandbox(
  mode: StorageMode,
  sandboxId: string,
): Promise<{ sandbox: Sandbox; cleanupHost: () => Promise<void> }> {
  let builder = Sandbox.builder(sandboxId).image(IMAGE).cpus(1).memory(512);

  if (mode === "juicefs") {
    const workspacePath = join(JFS_ROOT, "workspaces", TENANT, sandboxId);
    await mkdir(workspacePath, { recursive: true });
    builder = builder.volume("/workspace", (m) => m.bind(workspacePath));
    return {
      sandbox: await builder.create(),
      cleanupHost: () => rm(workspacePath, { recursive: true, force: true }),
    };
  }

  builder = builder.volume("/workspace", (m) =>
    m.tmpfs().size(WORKSPACE_TMPFS_MIB),
  );
  return { sandbox: await builder.create(), cleanupHost: async () => {} };
}

async function runIteration(
  mode: StorageMode,
  sizeMiB: number,
  hostUpFile: string,
  hostDownDir: string,
): Promise<Sample[]> {
  const sandboxId = `bench_${mode}_${sizeMiB}_${randomBytes(4).toString("hex")}`;
  const { sandbox, cleanupHost } = await buildSandbox(mode, sandboxId);
  const samples: Sample[] = [];

  try {
    const fs = sandbox.fs();

    // upload: host -> /workspace
    {
      const before = await snapshot(sandbox);
      const t = now();
      await fs.copyFromHost(hostUpFile, "/workspace/up.bin");
      const seconds = now() - t;
      const after = await snapshot(sandbox);
      samples.push(mkSample(mode, sizeMiB, "upload", seconds, before, after));
    }

    // in-sandbox write (fdatasync so JuiceFS actually flushes to the object store)
    {
      const before = await snapshot(sandbox);
      const t = now();
      const r = await sandbox.exec("dd", [
        "if=/dev/zero",
        "of=/workspace/w.bin",
        "bs=1M",
        `count=${sizeMiB}`,
        "conv=fdatasync",
      ]);
      const seconds = now() - t;
      const after = await snapshot(sandbox);
      if (r.code !== 0) throw new Error(`dd write failed: ${r.stderr()}`);
      samples.push(mkSample(mode, sizeMiB, "write", seconds, before, after));
    }

    // in-sandbox read
    {
      if (COLD_READ) {
        // Untimed: flush and drop the guest page cache so the read isn't warm.
        await sandbox.exec("sh", [
          "-c",
          "sync; echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true",
        ]);
      }
      const before = await snapshot(sandbox);
      const t = now();
      const r = await sandbox.exec("dd", [
        "if=/workspace/w.bin",
        "of=/dev/null",
        "bs=1M",
      ]);
      const seconds = now() - t;
      const after = await snapshot(sandbox);
      if (r.code !== 0) throw new Error(`dd read failed: ${r.stderr()}`);
      samples.push(mkSample(mode, sizeMiB, "read", seconds, before, after));
    }

    // download: /workspace -> host
    {
      const hostOut = join(hostDownDir, `${sandboxId}.bin`);
      const before = await snapshot(sandbox);
      const t = now();
      await fs.copyToHost("/workspace/w.bin", hostOut);
      const seconds = now() - t;
      const after = await snapshot(sandbox);
      await rm(hostOut, { force: true });
      samples.push(mkSample(mode, sizeMiB, "download", seconds, before, after));
    }
  } finally {
    try {
      await sandbox.stop();
    } catch {
      try {
        await sandbox.kill();
      } catch {
        /* ignore */
      }
    }
    await cleanupHost();
  }

  return samples;
}

function mkSample(
  mode: StorageMode,
  sizeMiB: number,
  op: Op,
  seconds: number,
  before: MetricsSnapshot,
  after: MetricsSnapshot,
): Sample {
  const delta = (a?: number, b?: number) =>
    a != null && b != null ? b - a : undefined;
  return {
    mode,
    sizeMiB,
    op,
    seconds,
    mibPerSec: seconds > 0 ? sizeMiB / seconds : 0,
    diskWriteDelta: delta(before.diskWriteBytes, after.diskWriteBytes),
    diskReadDelta: delta(before.diskReadBytes, after.diskReadBytes),
  };
}

// ── Reporting ───────────────────────────────────────────────────────────────

function fmt(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

function buildReport(
  samples: Sample[],
  modeStatus: Record<string, string>,
  metricsAvailable: boolean,
): string {
  const lines: string[] = [];
  lines.push("<!-- RESULTS:START (generated by tests/benchmarks/storage-bench.ts) -->");
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push("");
  lines.push(
    `**Config:** sizes = ${SIZES_MIB.join(", ")} MiB · iterations = ${ITERS} (first discarded as warmup) · modes = ${MODES.join(", ")} · read = ${COLD_READ ? "cold (guest cache dropped)" : "warm"}`,
  );
  lines.push("");
  for (const [mode, status] of Object.entries(modeStatus)) {
    lines.push(`- **${mode}**: ${status}`);
  }
  lines.push(
    `- **SDK metrics()**: ${metricsAvailable ? "available — disk-write deltas shown" : "unavailable at runtime — deltas omitted"}`,
  );
  lines.push("");

  // Throughput tables, one per size.
  for (const size of SIZES_MIB) {
    lines.push(`### ${size} MiB`);
    lines.push("");
    lines.push(
      "| Operation | tmpfs median MiB/s | tmpfs mean | JuiceFS median MiB/s | JuiceFS mean | JuiceFS vs tmpfs |",
    );
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
    for (const op of OPS) {
      const cell = (mode: StorageMode) => {
        const xs = samples
          .filter((s) => s.mode === mode && s.sizeMiB === size && s.op === op)
          .map((s) => s.mibPerSec);
        return { med: median(xs), avg: mean(xs), n: xs.length };
      };
      const t = cell("tmpfs");
      const j = cell("juicefs");
      const ratio =
        t.med > 0 && j.med > 0 ? `${fmt((j.med / t.med) * 100, 0)}%` : "—";
      lines.push(
        `| ${opLabel(op)} | ${t.n ? fmt(t.med) : "—"} | ${t.n ? fmt(t.avg) : "—"} | ${j.n ? fmt(j.med) : "—"} | ${j.n ? fmt(j.avg) : "—"} | ${ratio} |`,
      );
    }
    lines.push("");
  }

  lines.push("<!-- RESULTS:END -->");
  return lines.join("\n");
}

function opLabel(op: Op): string {
  switch (op) {
    case "upload":
      return "Upload (host→guest, copyFromHost)";
    case "download":
      return "Download (guest→host, copyToHost)";
    case "write":
      return "In-sandbox write (dd, fdatasync)";
    case "read":
      return `In-sandbox read (dd${COLD_READ ? ", cold" : ""})`;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const modeStatus: Record<string, string> = {};
  const activeModes: StorageMode[] = [];

  for (const mode of MODES) {
    if (mode === "juicefs") {
      const a = await juicefsAvailable();
      modeStatus["juicefs"] = a.ok ? `enabled — ${a.reason}` : `SKIPPED — ${a.reason}`;
      if (a.ok) activeModes.push("juicefs");
    } else {
      modeStatus["tmpfs"] = "enabled";
      activeModes.push("tmpfs");
    }
  }

  const hostScratch = await mkdtemp(join(tmpdir(), "locci-bench-"));
  const downDir = join(hostScratch, "down");
  await mkdir(downDir, { recursive: true });

  const samples: Sample[] = [];
  let metricsAvailable = false;

  for (const size of SIZES_MIB) {
    const upFile = join(hostScratch, `up-${size}.bin`);
    await makeHostFile(upFile, size);
    const upStat = await stat(upFile);
    process.stderr.write(
      `[bench] prepared ${size} MiB host file (${upStat.size} bytes)\n`,
    );

    for (const mode of activeModes) {
      for (let iter = 0; iter < ITERS; iter++) {
        const warm = iter === 0 ? " (warmup, discarded)" : "";
        process.stderr.write(
          `[bench] ${mode} ${size}MiB iter ${iter + 1}/${ITERS}${warm}\n`,
        );
        try {
          const iterSamples = await runIteration(mode, size, upFile, downDir);
          if (iter > 0) samples.push(...iterSamples);
          if (iterSamples.some((s) => s.diskWriteDelta != null))
            metricsAvailable = true;
        } catch (err) {
          process.stderr.write(
            `[bench] iteration failed: ${(err as Error).message}\n`,
          );
        }
      }
    }
  }

  await rm(hostScratch, { recursive: true, force: true });

  const report = buildReport(samples, modeStatus, metricsAvailable);
  process.stdout.write(report + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
