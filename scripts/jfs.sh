#!/usr/bin/env bash
# JuiceFS dev helper for the locci-box feature branch.
# Reads config/secrets from ./.env (never hard-codes keys in package.json).
#
# Usage: scripts/jfs.sh <format|mount|mount:fg|umount|status|info|verify|logs>
#
# Requires: juicefs (brew install juicefs) + macFUSE (brew install --cask macfuse)
# for the mount/verify commands. format/status work without macFUSE.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Metadata engine for the juicefs CLI (Valkey/Redis). App code does not use this —
# it operates on the POSIX mount at JFS_ROOT. Swap to tikv:// for production HA.
JFS_META_URL="${JFS_META_URL:-redis://127.0.0.1:6379/2}"
JFS_ROOT="${JFS_ROOT:?JFS_ROOT not set (define it in .env)}"
JFS_BUCKET="${JFS_BUCKET:-locci-box}"
RUSTFS_ENDPOINT="${RUSTFS_ENDPOINT:-http://127.0.0.1:9000}"

cmd="${1:-}"
case "$cmd" in
  format)
    : "${RUSTFS_ACCESS_KEY:?set RUSTFS_ACCESS_KEY in .env}"
    : "${RUSTFS_SECRET_KEY:?set RUSTFS_SECRET_KEY in .env}"
    # Idempotent: re-running on an existing volume just reports it already exists.
    juicefs format --storage s3 \
      --bucket "${RUSTFS_ENDPOINT}/${JFS_BUCKET}" \
      --access-key "${RUSTFS_ACCESS_KEY}" \
      --secret-key "${RUSTFS_SECRET_KEY}" \
      "${JFS_META_URL}" "${JFS_BUCKET}"
    ;;
  mount)
    mkdir -p "${JFS_ROOT}"
    # --enable-xattr required for microsandbox /workspace (strict mode needs xattrs)
    juicefs mount --enable-xattr --background "${JFS_META_URL}" "${JFS_ROOT}"
    echo "Mounted ${JFS_BUCKET} at ${JFS_ROOT}"
    ;;
  mount:fg)
    mkdir -p "${JFS_ROOT}"
    # Foreground — useful for watching block I/O to RustFS. Ctrl-C to stop.
    juicefs mount --enable-xattr "${JFS_META_URL}" "${JFS_ROOT}"
    ;;
  umount)
    juicefs umount "${JFS_ROOT}"
    echo "Unmounted ${JFS_ROOT}"
    ;;
  status)
    juicefs status "${JFS_META_URL}"
    ;;
  info)
    juicefs info "${JFS_ROOT}"
    ;;
  verify)
    # Proves data flows through JuiceFS to RustFS: write a file, then print the
    # object keys JuiceFS stored for it in the S3 bucket.
    f="${JFS_ROOT}/_rustfs_verify_$(date +%s).txt"
    echo "locci-box juicefs -> rustfs persistence check $(date)" > "$f"
    sync
    echo "Wrote: $f"
    echo "--- object keys in bucket '${JFS_BUCKET}' for this file ---"
    juicefs info "$f"
    ;;
  logs)
    tail -n 40 -f "${HOME}/.juicefs/juicefs.log"
    ;;
  *)
    echo "Usage: scripts/jfs.sh <format|mount|mount:fg|umount|status|info|verify|logs>" >&2
    exit 2
    ;;
esac
