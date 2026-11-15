#!/bin/bash
# shellcheck source-path=SCRIPTDIR
# Start this worktree's dev server in the background with zero output
# Usage: bash scripts/agent/dev-start.sh
# Picks the first free port from 3000 and records it in .dev-server.port.

set -e

# shellcheck source=lib/dev-server.sh
source "$(dirname "$0")/lib/dev-server.sh"

echo "Starting dev server..."

if dev_running && curl -s "$(dev_url)" > /dev/null 2>&1; then
  echo "Dev server: Already running | $(dev_url)"
  exit 0
fi

PORT=$(free_port) || {
  echo "Dev server: no free port in 3000-3099"
  exit 1
}

nohup pnpm dev -p "$PORT" > /dev/null 2>&1 &
DEV_PID=$!
echo $DEV_PID > "$DEV_PID_FILE"
echo "$PORT" > "$DEV_PORT_FILE"

# Wait for server to be ready (max 30s)
START=$(date +%s)
READY=false

for _ in {1..30}; do
  if curl -s "$(dev_url)" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

END=$(date +%s)
DURATION=$((END - START))

if [ "$READY" = true ]; then
  echo "Dev server: Ready (${DURATION}s) | PID: $DEV_PID | $(dev_url)"
else
  echo "Dev server: TIMEOUT (failed to start in 30s)"
  bash "$(dirname "$0")/dev-stop.sh" > /dev/null 2>&1 || true
  exit 1
fi
