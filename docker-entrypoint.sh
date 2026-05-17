#!/bin/bash
set -e

# Start microsandbox daemon (needs /dev/kvm)
if [ -e /dev/kvm ]; then
  msb start &
  sleep 3
fi

exec node dist/server.js
