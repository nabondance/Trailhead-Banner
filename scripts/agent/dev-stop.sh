#!/bin/bash
# shellcheck source-path=SCRIPTDIR
# Stop this checkout's dev servers
# Usage: bash scripts/agent/dev-stop.sh
# Stops the server recorded in .dev-server.pid and any `next dev` started by
# hand in this checkout. Dev servers of other worktrees are left alone.

set -e

# shellcheck source=lib/dev-server.sh
source "$(dirname "$0")/lib/dev-server.sh"

echo "Stopping dev server..."

STOPPED=""

if [ -f "$DEV_PID_FILE" ]; then
  PID=$(cat "$DEV_PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    stop_tree "$PID"
    STOPPED="$PID"
  fi
fi

for PID in $(hand_started_pids); do
  stop_tree "$PID"
  STOPPED="$STOPPED $PID"
done

rm -f "$DEV_PID_FILE" "$DEV_PORT_FILE"

if [ -n "$STOPPED" ]; then
  echo "Dev server: Stopped (PID:${STOPPED# })"
else
  echo "Dev server: Not running"
fi
