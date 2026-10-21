#!/bin/bash
set -e

# Use the runtime bundled with the microsandbox SDK (explicit paths win over
# ~/.microsandbox), and put its msb first on PATH, so the runtime, the SDK and
# the msb CLI are always one version.
MSB_PKG=$(find /app/node_modules -type d -path '*@superradcompany/microsandbox-linux-*' 2>/dev/null | head -1)
if [ -n "${MSB_PKG}" ] && [ -x "${MSB_PKG}/bin/msb" ]; then
  export MSB_PATH="${MSB_PKG}/bin/msb"
  export MSB_LIBKRUNFW_PATH=$(ls "${MSB_PKG}"/lib/libkrunfw.so* 2>/dev/null | head -1)
  export PATH="${MSB_PKG}/bin:$PATH"
  echo "[entrypoint] microsandbox runtime: $("${MSB_PATH}" --version 2>/dev/null) (${MSB_PKG})"
else
  echo "[entrypoint] WARN: no bundled microsandbox runtime found; using ~/.microsandbox"
  export PATH="/root/.microsandbox/bin:$PATH"
fi

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
