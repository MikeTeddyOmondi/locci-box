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
- **SDK:** `microsandbox@0.4.6`.
- **Host:** Linux x86_64, kernel `6.8.0-124-generic`.
- **JuiceFS CE:** `1.3.1+2025-12-02.e0032b2` (in-container CE binary).
- _Run date: 2026-06-15._

## Results

<!-- RESULTS:START -->

_Generated: 2026-06-15T17:51:02Z · thanos · sizes = 1, 10, 100 MiB · iterations = 5 (first discarded as warmup) · modes = tmpfs, juicefs._

- **tmpfs**: enabled
- **juicefs**: enabled — `/mnt/locci-box` writable (self-mounted in `api`)
- **SDK `metrics()`**: available

### 1 MiB

| Operation | tmpfs median MiB/s | tmpfs mean | JuiceFS median MiB/s | JuiceFS mean | JuiceFS vs tmpfs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Upload (host→guest, copyFromHost) | 35.1 | 35.0 | 8.3 | 8.2 | 24% |
| In-sandbox write (dd, fdatasync) | 55.8 | 55.4 | 8.6 | 8.6 | 15% |
| In-sandbox read (dd) | 198.4 | 199.5 | 72.3 | 70.7 | 36% |
| Download (guest→host, copyToHost) | 27.2 | 27.3 | 22.2 | 21.4 | 82% |

### 10 MiB

| Operation | tmpfs median MiB/s | tmpfs mean | JuiceFS median MiB/s | JuiceFS mean | JuiceFS vs tmpfs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Upload (host→guest, copyFromHost) | 48.7 | 49.2 | 13.2 | 13.2 | 27% |
| In-sandbox write (dd, fdatasync) | 278.2 | 277.6 | 15.7 | 15.1 | 6% |
| In-sandbox read (dd) | 990.2 | 985.6 | 15.5 | 15.6 | 2% |
| Download (guest→host, copyToHost) | 35.7 | 35.5 | 34.2 | 34.2 | 96% |

### 100 MiB

| Operation | tmpfs median MiB/s | tmpfs mean | JuiceFS median MiB/s | JuiceFS mean | JuiceFS vs tmpfs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Upload (host→guest, copyFromHost) | 61.4 | 61.2 | 13.0 | 13.0 | 21% |
| In-sandbox write (dd, fdatasync) | 336.4 | 336.1 | 14.6 | 14.5 | 4% |
| In-sandbox read (dd) | 1805.1 | 1795.2 | 12.1 | 12.0 | 1% |
| Download (guest→host, copyToHost) | 37.5 | 37.5 | 37.4 | 37.4 | 100% |

<!-- RESULTS:END -->

### Cold-read variant

Re-run with `COLD_READ=true` (drops the **guest** page cache via `sync; echo 3 >
/proc/sys/vm/drop_caches` before each in-sandbox read). Same config otherwise
(1/10/100 MiB, 5 iters, 2026-06-15).

| Size | Operation | tmpfs median MiB/s | JuiceFS median MiB/s | JuiceFS vs tmpfs |
| --- | --- | ---: | ---: | ---: |
| 1 MiB | In-sandbox read (cold) | 85.3 | 47.0 | 55% |
| 10 MiB | In-sandbox read (cold) | 590.3 | 15.2 | 3% |
| 100 MiB | In-sandbox read (cold) | 1675.9 | 11.5 | 1% |

Takeaways vs the warm read above:

- **JuiceFS large reads are unchanged** (warm ~12–16 vs cold ~11–15 MiB/s) — they were
  already storage-bound, not served from cache. Only the 1 MiB case shed cache benefit
  (warm ~72 → cold ~47 MiB/s).
- **tmpfs stays fast** because `drop_caches` can't evict tmpfs pages (tmpfs *is* page
  cache with no backing store to reclaim to).
- Caveat: this clears only the guest kernel cache; the JuiceFS client cache in the `api`
  container is untouched, so true cold-from-S3 reads could be at or below these figures.

## Interpretation

- **Raw I/O: tmpfs wins by 1–2 orders of magnitude, as expected.** tmpfs is RAM, so it
  scales with size (read hits ~1.8 GiB/s, write ~336 MiB/s at 100 MiB). JuiceFS raw write
  plateaus at **~14–16 MiB/s** regardless of size — gated by FUSE + synchronous S3 PUTs of
  4 MiB blocks under `conv=fdatasync`. JuiceFS read falls from ~72 MiB/s (1 MiB, served
  from cache) to **~12 MiB/s** at 100 MiB, where the working set exceeds cache and blocks
  must be fetched from the object store.

- **The host↔guest SDK channel is the real ceiling for transfers.** Upload/download go
  through the microsandbox host-guest channel, which caps tmpfs upload at ~35–61 MiB/s and
  download at ~27–37 MiB/s — far below tmpfs's raw speed. Because the channel dominates,
  **JuiceFS download is essentially identical to tmpfs (82–100%)**: the read is cache-warm
  (it immediately follows the write) so the storage backend barely matters.

- **JuiceFS upload pays the write penalty (~21–27% of tmpfs).** `copyFromHost` lands the
  bytes on the FUSE mount, so it inherits the S3-flush cost on top of the channel.

- **Trade-off.** JuiceFS is ~5–25× slower for write-heavy/large work, but buys per-user
  persistence, cross-run artifact recovery, and a billable storage axis
  (`GET /api/stats` → `storage_bytes`). For ephemeral compute, tmpfs (the default) is the
  right call; reserve JuiceFS for workloads that must persist or share state across runs.

> Caveats: in-sandbox **read** is warm-cache (runs right after the write); cold-read
> JuiceFS would be slower. Numbers reflect one S3 backend on one host on 2026-06-15 — treat
> as directional, re-run with `pnpm bench:storage` for your own environment.

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
