# JuiceFS Persistent Volumes for Locci Box

> Adds per-user persistent workspaces to every microsandbox run, backed by
> JuiceFS → Redis (metadata) + RustFS/S3 (data blocks).  
> Fully opt-in — `JFS_ENABLED=false` (default) is a zero-behaviour-change no-op.

---

## Table of Contents

- [JuiceFS Persistent Volumes for Locci Box](#juicefs-persistent-volumes-for-locci-box)
  - [Table of Contents](#table-of-contents)
  - [Architecture](#architecture)
  - [How It Works](#how-it-works)
  - [Prerequisites](#prerequisites)
  - [Files Changed](#files-changed)
  - [Implementation](#implementation)
    - [1. `src/config/env.ts`](#1-srcconfigenvts)
    - [2. `src/services/VolumeService.ts`](#2-srcservicesvolumeservicets)
    - [3. `src/services/SandboxService.ts`](#3-srcservicessandboxservicets)
    - [4. `compose.yaml`](#4-composeyaml)
    - [5. `.env.example`](#5-envexample)
  - [Running with JuiceFS](#running-with-juicefs)
    - [Development (thanos / local)](#development-thanos--local)
    - [Production (with real S3 or RustFS cluster)](#production-with-real-s3-or-rustfs-cluster)
    - [Without Docker (bare metal on thanos)](#without-docker-bare-metal-on-thanos)
  - [Volume Layout on Disk](#volume-layout-on-disk)
  - [Volume Types per Sandbox](#volume-types-per-sandbox)
  - [Storage Billing Hook](#storage-billing-hook)
  - [Upgrading to TiKV (Production)](#upgrading-to-tikv-production)
  - [Backlog Item](#backlog-item)

---

## Architecture

```
microsandbox microVM
  ├── /workspace   ← rw, JuiceFS-backed (persists across runs per user)
  ├── /shared      ← ro, shared datasets (optional, if dir exists)
  └── /tmp/sandbox ← tmpfs, ephemeral scratch (always, zero cleanup)
          ↑
    VolumeService.provision(userId, sandboxId)
          ↑
    /mnt/locci-box  (JuiceFS FUSE mount on host)
          ↑
    ┌─────────────┐     ┌──────────────────────────┐
    │    Redis    │     │  RustFS / any S3-compat  │
    │  (metadata) │     │  (4 MiB content-addressed│
    │  redis:6379 │     │   data blocks)           │
    └─────────────┘     └──────────────────────────┘
```

JuiceFS splits the concerns:
- **Redis** stores inode metadata, directory trees, and file-to-block mappings.
- **RustFS** stores the actual file content as opaque 4 MiB blocks (not human-readable files).
- **JuiceFS client** (FUSE daemon) stitches these together into a POSIX filesystem at `/mnt/locci-box`.

---

## How It Works

1. When `JFS_ENABLED=true`, `VolumeService.provision(userId, sandboxId)` creates the directory `workspaces/<userId>/<sandboxId>/` inside the JuiceFS mount and sets a storage quota.
2. `SandboxService.execute()` passes that host path as a `.bind()` volume mount to the microsandbox builder, making it appear at `/workspace` inside the microVM.
3. When the sandbox is stopped or times out, `VolumeService.cleanup()` removes the per-run subdirectory. The parent `workspaces/<userId>/` directory persists — the next run for that user starts fresh but the user's prior runs are retained until they expire or are explicitly deleted.
4. When `JFS_ENABLED=false` (the default), `VolumeService.provision()` returns `null` and the builder falls back to a `tmpfs` mount — identical to the current behaviour.

---

## Prerequisites

On the host machine running `compose.yaml` (thanos):

- **KVM** — already required by microsandbox.
- **FUSE** — `/dev/fuse` must be present (standard on Ubuntu 24.04).
- **RustFS** (or any S3-compatible store) accessible from the Docker network.
- No other changes to the host OS required — JuiceFS runs fully inside Docker.

---

## Files Changed

| File | Change |
|------|--------|
| `src/config/env.ts` | +8 lines — 3 new env vars in the Valibot schema |
| `src/services/VolumeService.ts` | New file — ~80 lines |
| `src/services/SandboxService.ts` | +15 lines — volume wiring in `execute()` and cleanup |
| `compose.yaml` | +50 lines — `redis`, `juicefs-init`, `juicefs` services under `jfs` profile |
| `.env.example` | +5 lines — `JFS_*` vars documented |

---

## Implementation

### 1. `src/config/env.ts`

Add three new fields to the existing `EnvSchema` object:

```typescript
// Persistent volumes via JuiceFS (optional)
JFS_ENABLED: v.optional(
  v.pipe(v.string(), v.transform((v) => v === "true")),
  "false",
),
JFS_ROOT: v.optional(v.string(), "/mnt/locci-box"),
JFS_QUOTA_MIB: v.optional(v.pipe(v.string(), v.transform(Number)), "512"),
```

Also extend the `parseEnv()` call to include them:

```typescript
JFS_ENABLED:   process.env.JFS_ENABLED,
JFS_ROOT:      process.env.JFS_ROOT,
JFS_QUOTA_MIB: process.env.JFS_QUOTA_MIB,
```

---

### 2. `src/services/VolumeService.ts`

Create this file from scratch:

```typescript
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
  async provision(userId: string, sandboxId: string): Promise<SandboxVolumePaths> {
    if (!this.enabled) {
      return { workspace: null, shared: null };
    }

    const workspacePath = join(this.root, "workspaces", userId, sandboxId);
    const sharedPath = join(this.root, "shared");

    try {
      await mkdir(workspacePath, { recursive: true });
      await this.setQuota(workspacePath);

      logger.info({ userId, sandboxId, workspacePath }, "Provisioned JuiceFS workspace");

      return {
        workspace: workspacePath,
        shared: existsSync(sharedPath) ? sharedPath : null,
      };
    } catch (err) {
      logger.warn({ err, workspacePath }, "JuiceFS provision failed, falling back to tmpfs");
      return { workspace: null, shared: null };
    }
  }

  /**
   * Remove a per-run workspace directory after TTL or explicit sandbox deletion.
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
   * Feed into billing alongside compute duration.
   */
  async measureUsage(userId: string): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const { stdout } = await execAsync(
        `juicefs quota get ${this.root} --path workspaces/${userId} 2>/dev/null | awk '/used/{print $2}'`
      );
      const mib = parseFloat(stdout.trim()) || 0;
      return Math.round(mib * 1024 * 1024); // return bytes
    } catch {
      return 0;
    }
  }

  private async setQuota(path: string): Promise<void> {
    const relative = path.replace(this.root + "/", "");
    try {
      await execAsync(
        `juicefs quota set ${this.root} --path ${relative} --capacity ${this.quotaMib} 2>/dev/null`
      );
    } catch {
      // quota set is best-effort — JuiceFS community edition may not support it
    }
  }
}

export const volumeService = new VolumeService();
```

---

### 3. `src/services/SandboxService.ts`

**Add import at the top:**

```typescript
import { volumeService } from "./VolumeService.js";
```

**Inside `execute()`, before the `Sandbox.builder(...)` call:**

```typescript
// Provision persistent workspace (no-op if JFS_ENABLED=false)
const volumes = await volumeService.provision(tenantId, sandboxId);
```

**Extend the sandbox builder chain** — replace the bare `.create()` with:

```typescript
let builder = Sandbox.builder(sandboxId)
  .image(image)
  .cpus(1)
  .memory(512)
  .network(/* existing network policy — unchanged */)
  .replace();

// Persistent workspace — JuiceFS bind if available, tmpfs fallback
if (volumes.workspace) {
  builder = builder.volume("/workspace", (m) =>
    m.bind(volumes.workspace!)
  );
} else {
  builder = builder.volume("/workspace", (m) => m.tmpfs().size(512));
}

// Read-only shared datasets (e.g. pre-loaded pip wheels, npm cache)
if (volumes.shared) {
  builder = builder.volume("/shared", (m) =>
    m.bind(volumes.shared!).readonly()
  );
}

// Ephemeral scratch — always tmpfs, zero cleanup cost
builder = builder.volume("/tmp/sandbox", (m) => m.tmpfs().size(256));

const sandbox = await builder.create();
```

**In the sandbox cleanup path** (wherever `sandbox.stop()` / `sandbox.kill()` is called):

```typescript
// After stopping the sandbox
await volumeService.cleanup(tenantId, sandboxId);
```

---

### 4. `compose.yaml`

Add three new services under the `jfs` Compose profile, and extend the `api` service with the shared mount and new env vars.

**New services** (append to the `services:` block):

```yaml
  redis:
    image: redis:7-alpine
    container_name: locci-box-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    networks:
      - default
    profiles:
      - jfs

  juicefs-init:
    # One-shot: formats the JuiceFS volume if not already done.
    # Safe to re-run — exits 0 if the volume already exists.
    image: juicedata/juicefs:latest
    container_name: locci-box-jfs-init
    depends_on:
      - redis
    entrypoint:
      - sh
      - -c
      - |
        juicefs format \
          --storage s3 \
          --bucket http://${RUSTFS_ENDPOINT:-rustfs:9000}/${JFS_BUCKET:-locci-box} \
          --access-key ${RUSTFS_ACCESS_KEY:-loccidev} \
          --secret-key ${RUSTFS_SECRET_KEY:-loccidev123} \
          redis://redis:6379/2 \
          locci-box 2>&1 | grep -v "already exists" || true
    networks:
      - default
    profiles:
      - jfs

  juicefs:
    # Long-running FUSE daemon. Mounts /mnt/locci-box on the host via shared propagation.
    image: juicedata/juicefs:latest
    container_name: locci-box-jfs
    restart: unless-stopped
    depends_on:
      juicefs-init:
        condition: service_completed_successfully
    privileged: true
    devices:
      - /dev/fuse
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor:unconfined
    entrypoint:
      - sh
      - -c
      - |
        mkdir -p /mnt/locci-box && \
        juicefs mount \
          --cache-dir /var/jfs-cache \
          --cache-size 10240 \
          --writeback \
          --background \
          redis://redis:6379/2 \
          /mnt/locci-box && \
        tail -f /dev/null
    volumes:
      - jfs-cache:/var/jfs-cache
      - /mnt/locci-box:/mnt/locci-box:shared
    networks:
      - default
    profiles:
      - jfs
```

**Extend the existing `api` service** with the mount and new env vars:

```yaml
  api:
    # ... all existing config unchanged ...
    depends_on:
      # add this alongside existing depends_on entries:
      juicefs:
        condition: service_started
    volumes:
      - db-data:/app/data
      - /mnt/locci-box:/mnt/locci-box:shared   # ← add this line
    environment:
      # ... all existing env vars unchanged ...
      JFS_ENABLED: ${JFS_ENABLED:-false}
      JFS_ROOT: /mnt/locci-box
      JFS_QUOTA_MIB: ${JFS_QUOTA_MIB:-512}
```

**New volumes** (append to the `volumes:` block):

```yaml
  redis-data:
    name: locci-box-redis-data
    driver: local
  jfs-cache:
    name: locci-box-jfs-cache
    driver: local
```

---

### 5. `.env.example`

Add after the existing `DATABASE_*` block:

```env
# ── JuiceFS Persistent Volumes ────────────────────────────────────────────────
# Set JFS_ENABLED=true to give each sandbox a persistent /workspace volume
# backed by JuiceFS → Redis (metadata) + RustFS/S3 (data blocks).
# Requires starting with: docker compose --profile jfs up -d
JFS_ENABLED=false
JFS_ROOT=/mnt/locci-box
JFS_QUOTA_MIB=512

# RustFS / S3-compatible endpoint for JuiceFS data blocks
RUSTFS_ENDPOINT=rustfs:9000
RUSTFS_ACCESS_KEY=loccidev
RUSTFS_SECRET_KEY=loccidev123
JFS_BUCKET=locci-box
```

---

## Running with JuiceFS

### Development (thanos / local)

```bash
# First time only — pull the JuiceFS image
docker pull juicedata/juicefs:latest

# Start everything including JuiceFS
JFS_ENABLED=true \
RUSTFS_ACCESS_KEY=<key> \
RUSTFS_SECRET_KEY=<secret> \
docker compose --profile jfs up -d

# Verify the mount is live
docker exec locci-box-jfs juicefs status redis://redis:6379/2

# Check the mount on the host
ls /mnt/locci-box
```

### Production (with real S3 or RustFS cluster)

```bash
cp .env .env.prod
# Edit .env.prod:
#   JFS_ENABLED=true
#   RUSTFS_ENDPOINT=rustfs.internal:9000
#   RUSTFS_ACCESS_KEY=<prod-key>
#   RUSTFS_SECRET_KEY=<prod-secret>
#   JFS_QUOTA_MIB=1024

docker compose --env-file .env.prod --profile jfs up -d
```

### Without Docker (bare metal on thanos)

```bash
# Install JuiceFS binary
curl -sSL https://d.juicefs.com/install | sh

# Format once
juicefs format \
  --storage s3 \
  --bucket http://rustfs.thanos.local:9000/locci-box \
  --access-key <key> \
  --secret-key <secret> \
  redis://localhost:6379/2 \
  locci-box

# Mount as a systemd service
cat > /etc/systemd/system/locci-jfs.service << 'EOF'
[Unit]
Description=JuiceFS locci-box volume
After=network-online.target redis.service
Wants=network-online.target

[Service]
Type=forking
ExecStart=/usr/local/bin/juicefs mount \
  --cache-dir /mnt/jfs-cache \
  --cache-size 20480 \
  --writeback \
  --background \
  redis://localhost:6379/2 /mnt/locci-box
ExecStop=/usr/local/bin/juicefs umount /mnt/locci-box
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now locci-jfs
```

---

## Volume Layout on Disk

Inside `/mnt/locci-box` (the JuiceFS mount), the directory structure is:

```
/mnt/locci-box/
  workspaces/
    <tenantId>/
      <sandboxId-1>/    ← mounted at /workspace inside run 1
      <sandboxId-2>/    ← mounted at /workspace inside run 2
      ...
  shared/
    datasets/           ← optional, pre-staged read-only data
    pip-cache/          ← optional, shared pip wheel cache
```

Each `<sandboxId>/` directory is created on sandbox start and deleted on sandbox stop. The `<tenantId>/` parent persists, giving you a natural per-user audit trail and the ability to recover artifacts before cleanup if needed.

---

## Volume Types per Sandbox

| Mount path | Type | Persists | Shared | Purpose |
|---|---|---|---|---|
| `/workspace` | JuiceFS bind (or tmpfs fallback) | Per user | No | User's working files, output artifacts |
| `/shared` | JuiceFS bind, read-only | Forever | All sandboxes | Pre-loaded datasets, model weights |
| `/tmp/sandbox` | tmpfs | No | No | Scratch, build artefacts, pip/npm installs |

---

## Storage Billing Hook

`VolumeService.measureUsage(userId)` returns used bytes for a user's total workspace directory. Wire it into the existing `GET /api/stats` response alongside compute duration:

```typescript
// In TenantService or a new BillingService:
import { volumeService } from "./VolumeService.js";

const storageBytes = await volumeService.measureUsage(tenantId);

// Append to stats response:
return {
  ...existingStats,
  storage_bytes: storageBytes,
  storage_mib: Math.round(storageBytes / (1024 * 1024)),
};
```

This lets you bill on two axes — execution time (already tracked via `duration_ms` in `sandbox_runs`) and storage (polled from JuiceFS quota).

---

## Upgrading to TiKV (Production)

Redis uses asynchronous replication, meaning a failover after a crash can lose the most recent metadata writes. For production Locci Cloud with hard durability requirements, swap Redis for TiKV (3-node Raft cluster):

```bash
# After deploying TiKV via tiup or k3s
juicefs format \
  --storage s3 \
  --bucket http://rustfs.prod:9000/locci-box-prod \
  --access-key <key> \
  --secret-key <secret> \
  tikv://pd-node1:2379,pd-node2:2379,pd-node3:2379/locci-vol \
  locci-box-prod
```

The JuiceFS client, `VolumeService`, and all sandbox code stay identical — only the `JFS_META_URL` env var changes. TiKV gives you automatic leader election and zero data loss on node failure.

---

## Backlog Item

Add to `BACKLOG.md` under **Production Hardening**:

```markdown
- [ ] **JuiceFS persistent workspaces** — `JFS_ENABLED=true` + Redis + RustFS/S3
  mounts a per-user `/workspace` volume backed by JuiceFS into every sandbox.
  Enables stateful agent sessions, output artifact persistence, and
  per-user storage billing via `VolumeService.measureUsage()`.
  Compose profile: `docker compose --profile jfs up -d`
  Upgrade path: swap Redis metadata engine for TiKV for production HA.
```

---

*Generated for locci-box v1.5.0 — compatible with microsandbox SDK v0.4.6+*