#!/bin/sh
set -e
# Start SSR server on port 3001
PORT=3001 bun dist/server/server.js &
# Give it a moment to start
sleep 2
# Start nginx (serves static assets + proxies SSR)
exec nginx -g "daemon off;"
