#!/bin/bash
set -e

export PATH="/root/.microsandbox/bin:$PATH"

# Grant all processes access to /dev/kvm (child sandbox processes need it)
if [ -e /dev/kvm ]; then
  chmod 666 /dev/kvm || true
fi

exec node dist/server.js
