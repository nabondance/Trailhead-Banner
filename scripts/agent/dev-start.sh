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

# A `pnpm dev` started by hand in this checkout: reuse it, since a second
# next dev cannot run in the same directory
HAND=$(hand_started_pids | head -1)
if [ -n "$HAND" ]; then
  HAND_PORT=$(listen_port "$HAND")
  if [ -n "$HAND_PORT" ] && curl -s "http://localhost:$HAND_PORT" > /dev/null 2>&1; then
    echo "$HAND_PORT" > "$DEV_PORT_FILE"
    echo "Dev server: Already running (started by hand, PID $HAND) | http://localhost:$HAND_PORT"
    exit 0
  fi
  echo "Dev server: a dev server started by hand runs in this checkout (PID $HAND) but its port is unknown"
  echo "Stop it with: bash scripts/agent/dev-stop.sh"
  exit 1
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
  # Our process died (e.g. another worktree took the port first): whatever
  # answers on the port is not this checkout's server
  ps -p "$DEV_PID" > /dev/null 2>&1 || break
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
  echo "Dev server: failed to start on port $PORT"
  bash "$(dirname "$0")/dev-stop.sh" > /dev/null 2>&1 || true
  exit 1
fi
