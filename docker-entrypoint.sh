#!/bin/bash
set -e

export PATH="/root/.microsandbox/bin:$PATH"

# Grant all processes access to /dev/kvm (child sandbox processes need it)
if [ -e /dev/kvm ]; then
  chmod 666 /dev/kvm || true
fi

# Optional: mount JuiceFS inside this container instead of via a sidecar.
# Used by compose.rootless.yml because rootless Docker can't propagate a
# :shared bind mount between containers. Best-effort: on failure the app's
# VolumeService falls back to tmpfs. Requires privileged + /dev/fuse + SYS_ADMIN.
if [ "${JFS_SELF_MOUNT}" = "true" ]; then
  JFS_ROOT="${JFS_ROOT:-/mnt/locci-box}"
  JFS_META_URL="${JFS_META_URL:-redis://valkey:6379/2}"
  mkdir -p "${JFS_ROOT}"
  echo "[entrypoint] self-mounting JuiceFS ${JFS_META_URL} -> ${JFS_ROOT}"
  # --enable-xattr is REQUIRED: microsandbox strict mode rejects a /workspace whose
  # filesystem lacks extended-attribute support ("xattr not supported on root filesystem").
  juicefs mount --enable-xattr --background "${JFS_META_URL}" "${JFS_ROOT}" \
    || echo "[entrypoint] WARN: JuiceFS self-mount failed; VolumeService will fall back to tmpfs"
fi

exec node dist/server.js
