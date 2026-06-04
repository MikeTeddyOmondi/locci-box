# Locci Box — Deployment Guide

How to deploy Locci Box (API + Web + CLI) with **JuiceFS persistent workspaces**
backed by **Valkey** (metadata) + an **S3-compatible store** (RustFS / MinIO / S3).

This guide records what was validated end-to-end on the `thanos` homelab host and
the gotchas found along the way. See also [JUICEFS_IMPLEMENTATION.md](JUICEFS_IMPLEMENTATION.md)
for the code-level design.

---

## 1. Architecture

```
locci-box-api (microsandbox + Express)
  └── /workspace  ← per-run bind, JuiceFS-backed (persists to S3)   [JFS_ENABLED=true]
                     fallback: tmpfs                                  [JFS_ENABLED=false]
        ↑
   JuiceFS FUSE mount at /mnt/locci-box
        ↑                         ↑
   Valkey (metadata)        RustFS / S3 (4 MiB data blocks)
   redis://…:6379/2         http(s)://…:9000/<bucket>
```

- **Valkey/Redis** stores inode metadata; **RustFS/S3** stores opaque data blocks.
- The app (`VolumeService`) only does POSIX `mkdir`/`du`/`rm` on `JFS_ROOT`; it does
  not talk to S3 directly. The JuiceFS client (FUSE) bridges to S3.
- `JFS_ENABLED=false` (default) is a zero-change no-op (`/workspace` → tmpfs).

---

## 2. Prerequisites (host)

| Requirement | Why |
|---|---|
| **KVM** (`/dev/kvm`) | microsandbox boots microVMs |
| **FUSE** (`/dev/fuse`) | JuiceFS mount |
| **Valkey/Redis** | JuiceFS metadata engine (run with `--appendonly yes` for durability) |
| **S3-compatible endpoint** | JuiceFS data blocks (RustFS/MinIO/S3) |
| **`juicedata/mount:ce-vX.Y.Z`** image, or the **official CE binary** | JuiceFS client |

> ⚠️ **`juicedata/juicefs:latest` is a Docker _plugin_, not a runnable image** —
> `docker create`/Compose reject it. Use **`juicedata/mount:ce-v1.3.1`**.
>
> ⚠️ The `juicedata/mount` **binary** is dynamically linked to `librados.so.2` /
> `libfdb_c.so` (Ceph/FoundationDB). For a bare binary on a minimal host, install the
> **official CE binary** (`curl -fsSL https://d.juicefs.com/install | sh`) instead — it
> is self-contained for S3.
>
> ⚠️ **Always mount JuiceFS with `--enable-xattr`.** microsandbox runs in strict mode
> and refuses a `/workspace` without extended attributes
> (`xattr not supported on root filesystem`).

---

## 3. Environment (`.env`)

```env
# API
ADMIN_API_KEY=admin_xxxxxxxx            # required
JWT_SECRET=xxxxxxxx                      # required
NODE_ENV=production
DATABASE_MODE=pglite                     # or postgresql (+ DATABASE_URL, prod-db profile)

# JuiceFS persistent workspaces
JFS_ENABLED=true
JFS_ROOT=/mnt/locci-box
JFS_QUOTA_MIB=512
JFS_META_URL=redis://valkey:6379/2       # in-container; bare-metal: redis://127.0.0.1:6379/2

# S3 / RustFS for JuiceFS data blocks
RUSTFS_ENDPOINT=http://<HOST_IP>:9000    # MUST be reachable from inside the container —
                                         # use the host LAN IP, NOT 127.0.0.1
RUSTFS_ACCESS_KEY=xxxxxxxx
RUSTFS_SECRET_KEY=xxxxxxxx
JFS_BUCKET=locci-box                     # bucket must already exist
```

`.env` is gitignored. `JFS_META_URL` is consumed only by the JuiceFS CLI / self-mount,
not by the app.

---

## 4. Deployment modes

Pick based on your Docker setup. **Execution (running code) requires unrestricted KVM
access — i.e. rootful Docker or bare-metal.** (See §6.)

### 4A. Rootful Docker — recommended for production VPS

Uses the default [`compose.yaml`](../compose.yaml) `jfs` profile: a **sidecar `juicefs`
container** mounts `/mnt/locci-box` and shares it to `api` via a `:shared` bind.

```bash
# One-time: make the mount point a shared mount (required for :shared propagation)
sudo mkdir -p /mnt/locci-box
sudo mount --bind /mnt/locci-box /mnt/locci-box
sudo mount --make-shared /mnt/locci-box

docker compose --profile jfs up -d --build
docker compose --profile jfs ps
```

Services: `api`, `web`, `valkey`, `juicefs-init` (one-shot format), `juicefs` (mount).

### 4B. Rootless Docker — use `compose.rootless.yml`

Rootless Docker **cannot propagate a `:shared` bind between containers** (you get
`path /mnt/locci-box … is not a shared mount`, even after `mount --make-shared` inside
rootlesskit's namespace). So [`compose.rootless.yml`](../compose.rootless.yml) mounts
JuiceFS **inside the `api` container** (`JFS_SELF_MOUNT=true`, handled by
`docker-entrypoint.sh`; the CE binary is baked into the api image).

```bash
# RUSTFS_ENDPOINT in .env must be the host LAN IP (containers can't reach 127.0.0.1).
# Make /dev/kvm world-accessible (rootless maps it to nobody:nogroup otherwise):
sudo chmod 666 /dev/kvm

docker compose -f compose.rootless.yml --profile jfs up -d --build
```

The `api` container runs `privileged` + `/dev/fuse` + `SYS_ADMIN` (FUSE) + `/dev/kvm`.

### 4C. Bare-metal (no Docker)

Most reliable for execution (direct host KVM). Requires a Node runtime + the JuiceFS
CE binary + Valkey.

```bash
# JuiceFS CE binary
curl -fsSL https://d.juicefs.com/install | sh

# Valkey (durable metadata)
docker run -d --name locci-box-valkey -p 6379:6379 -v locci-box-valkey-data:/data \
  valkey/valkey:8.0.2 valkey-server --appendonly yes --appendfsync everysec

# Format once (bucket must exist), then mount with xattr
juicefs format --storage s3 --bucket http://<HOST_IP>:9000/locci-box \
  --access-key <AK> --secret-key <SK> redis://127.0.0.1:6379/2 locci-box
juicefs mount --enable-xattr --background redis://127.0.0.1:6379/2 /mnt/locci-box

# Run the API natively (JFS_ENABLED=true, JFS_ROOT=/mnt/locci-box in .env)
```

A `scripts/jfs.sh` helper wraps format/mount/status/verify (reads `.env`):
`pnpm jfs:format`, `pnpm jfs:mount`, `pnpm jfs:status`, `pnpm jfs:verify`.

---

## 5. Verifying JuiceFS ↔ S3

```bash
# Inside the api container (or bare-metal): write a file, confirm it lands in S3
docker exec locci-box-api sh -c 'echo hi > /mnt/locci-box/_e2e.txt; sync'
mc ls --recursive <alias>/locci-box        # expect chunks/0/0/... objects

# Durability round-trip (gold standard): write -> unmount -> wipe cache -> remount -> read
# md5 must match (proves data came from S3, not local cache).
```

Storage usage is also surfaced at `GET /api/stats` as `storage_bytes` / `storage_mib`
(via `VolumeService.measureUsage()`).

---

## 6. Known issues & caveats (validated on thanos)

### Execution requires rootful Docker or bare-metal
On **rootless Docker**, microsandbox cannot complete a microVM boot even after fixes:
1. `xattr not supported on root filesystem` → fixed by `--enable-xattr` (done in all mount paths).
2. `SIGABRT … before agent relay` → `/dev/kvm` is `nobody:nogroup` in the userns;
   fixed by `sudo chmod 666 /dev/kvm` on the host.
3. `handshake read id_offset: timed out before relay sent bytes` → the in-VM agent
   relay never completes under rootless Docker (nested-virt / vsock), **even with
   `/dev/vhost-vsock` passed and chmod'd**. This is the hard stop.

**Conclusion:** JuiceFS persistence works fully under rootless Docker, but **code
execution does not** — deploy the API on **rootful Docker** or **bare-metal** (both give
unrestricted KVM). A standard production VPS running rootful Docker is expected to work
with `compose.yaml --profile jfs`.

### `RUSTFS_ENDPOINT` must be container-reachable
Inside a container, `127.0.0.1` is the container itself. Use the host LAN IP
(e.g. `http://192.168.0.100:9000`) or attach the locci-box containers to the RustFS
network and use the service name.

### Public S3 endpoint via a tunnel can break JuiceFS SigV4
Against a Cloudflare-tunnelled hostname (`https://s3.mt0.dev`), `juicefs` (AWS SDK v2)
fails with `SignatureDoesNotMatch (403)` — even on a no-body `CreateBucket`, and even
with `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. The **same creds + `mc` work**,
and **juicefs against the direct RustFS endpoint works**. So:
- The internal `rustfs-cluster/nginx.conf` is already S3-correct (`Host $http_host`,
  `proxy_request_buffering off`, `chunked_transfer_encoding off`) — not the problem.
- The breakage is in the **TLS/tunnel layer** (Cloudflare) mangling juicefs's signed
  request. **Fix there** (bypass CF for the S3 host, or disable transforms), or point
  JuiceFS at the **direct/internal** RustFS endpoint.

### Other notes
- Run Valkey with `--appendonly yes` (AOF). Otherwise a restart drops JuiceFS metadata
  and you must re-format (and clear the bucket prefix first).
- A re-`format` fails with `storage … is not empty` if the bucket prefix has stale
  objects from a prior volume; clear it (`mc rm --recursive --force <alias>/locci-box/`).
- The external `proxy-network` must exist: `docker network create proxy-network`.

---

## 7. What was validated on thanos (2026-06-04)

| Item | Result |
|---|---|
| `juicefs format` + FUSE mount vs RustFS (bare-metal) | ✅ |
| Durability round-trip (unmount → cache wipe → remount, md5 match) | ✅ |
| Docker image build (api + web) | ✅ |
| `compose.yaml --profile jfs` (rootless) `:shared` propagation | ❌ rootless limitation |
| `compose.rootless.yml` api self-mount JuiceFS (`--enable-xattr`) | ✅ |
| In-container write → object appears in RustFS | ✅ |
| microsandbox KVM boot (after `chmod 666 /dev/kvm`) | ✅ boots |
| microsandbox code execution under rootless Docker | ❌ relay handshake timeout |

**Net:** the JuiceFS persistent-workspace feature is production-ready; run the API on
rootful Docker / bare-metal for code execution.
