# Storage Benchmarks — Normal (tmpfs) vs JuiceFS

## Overview

Locci Box runs user code in [microsandbox.dev](https://microsandbox.dev) microVMs. The
sandbox `/workspace` is provisioned two ways (see
[`VolumeService`](../src/services/VolumeService.ts)):

| Mode | `JFS_ENABLED` | `/workspace` backing | Persistence |
| --- | --- | --- | --- |
| **Normal storage** | `false` (default) | `tmpfs` (RAM, 512 MiB) | Ephemeral — cleared on stop |
| **JuiceFS** | `true` | FUSE mount under `/mnt/locci-box` | Persistent (Valkey metadata + S3 blocks) |

This document quantifies the cost of JuiceFS persistence vs ephemeral tmpfs across two
distinct layers, using the microsandbox SDK's own `sandbox.metrics()` instrumentation.

## Methodology

Harness: [`tests/benchmarks/storage-bench.ts`](../tests/benchmarks/storage-bench.ts)
(`pnpm bench:storage`). For each `(mode, file-size, iteration)` it builds a fresh
`python:3.11-slim` sandbox, then times four operations:

| Operation | What it measures | How |
| --- | --- | --- |
| **Upload** | Host → guest transfer over the SDK channel | `sandbox.fs().copyFromHost(hostFile, /workspace/up.bin)` |
| **Download** | Guest → host transfer over the SDK channel | `sandbox.fs().copyToHost(/workspace/w.bin, hostFile)` |
| **In-sandbox write** | Raw storage write throughput (tmpfs vs FUSE) | `dd if=/dev/zero of=/workspace/w.bin bs=1M count=N conv=fdatasync` |
| **In-sandbox read** | Raw storage read throughput | `dd if=/workspace/w.bin of=/dev/null bs=1M` |

- `conv=fdatasync` forces JuiceFS to flush to its S3 backend so writes aren't just
  measuring the local write-back cache.
- Defaults: `SIZES_MIB=1,10,100`, `ITERS=5` (first iteration discarded as warmup).
  Override via env vars, e.g. `MODES=tmpfs,juicefs SIZES_MIB=10,100 ITERS=7`.
- `sandbox.metrics()` is snapshotted before/after each op; disk-write deltas are reported
  when the runtime exposes them.
- Throughput is wall-clock derived: `MiB/s = fileSizeMiB / elapsedSeconds`. Reported as
  median (primary) and mean across the non-warmup iterations.

> **Read-throughput caveat:** the read op may be served partly from the JuiceFS/page
> cache since it immediately follows the write. Treat in-sandbox read numbers as
> warm-cache figures, not cold-storage reads.

## Environment

- **Host:** `thanos` (staging), **rootless Docker**.
- **Topology:** Per [`compose.rootless.yml`](../compose.rootless.yml) +
  [`docker-entrypoint.sh`](../docker-entrypoint.sh), the `api` container **self-mounts
  JuiceFS internally** (`JFS_SELF_MOUNT=true`: `juicefs mount --enable-xattr --background
  redis://valkey:6379/2 /mnt/locci-box`). There is **no separate `juicefs` sidecar** —
  rootless Docker can't propagate a `:shared` bind mount between containers, so the mount
  lives inside `api`. The image ([`Dockerfile`](../Dockerfile)) bundles both the `msb`
  CLI and the JuiceFS CE binary.
- **JuiceFS metadata:** Valkey (`redis://valkey:6379/2`). **Data:** S3-compatible object store.
- **SDK:** `microsandbox@^0.4.6`.
- _(Exact kernel / JuiceFS CE version / S3 backend recorded with the results below.)_

## Results

<!-- RESULTS:START -->
_Not yet run. Populate by running the harness inside the thanos `api` container:_

```bash
# from ~/src/locci-box on thanos
docker compose cp tests/benchmarks/storage-bench.ts api:/tmp/storage-bench.ts
docker compose exec -e MODES=tmpfs,juicefs -e SIZES_MIB=1,10,100 -e ITERS=5 \
  api node_modules/.bin/tsx /tmp/storage-bench.ts
```

Paste the harness's Markdown output (everything between its own `RESULTS` markers) here.
<!-- RESULTS:END -->

## Interpretation

_(Filled in after the first run.)_ Expect:

- **tmpfs** to dominate raw I/O (RAM-speed, no FUSE/network round-trips).
- **JuiceFS** write throughput gated by FUSE + S3 PUT latency and the 4 MiB block size;
  metadata ops gated by Valkey round-trips.
- The trade-off JuiceFS buys: per-user persistence, cross-run artifact recovery, and a
  billable storage axis (`GET /api/stats` → `storage_bytes`).

## How to reproduce

```bash
# Local (tmpfs only; JuiceFS auto-skips if /mnt/locci-box isn't writable)
pnpm bench:storage

# Custom run
MODES=tmpfs,juicefs SIZES_MIB=10,100 ITERS=7 pnpm bench:storage
```

The harness prints a self-contained Markdown report to stdout and auto-skips JuiceFS with a
recorded reason if its workspace root isn't writable, so it never silently benchmarks tmpfs
twice.
