#!/bin/bash
# shellcheck source-path=SCRIPTDIR
# Stop this worktree's background dev server
# Usage: bash scripts/agent/dev-stop.sh
# Only stops the server recorded in .dev-server.pid: dev servers of other
# worktrees are left alone.

set -e

# shellcheck source=lib/dev-server.sh
source "$(dirname "$0")/lib/dev-server.sh"

echo "Stopping dev server..."

if [ ! -f "$DEV_PID_FILE" ]; then
  echo "Dev server: Not running (no PID file)"
  exit 0
fi

PID=$(cat "$DEV_PID_FILE")

# pnpm starts next, which starts its own workers: stop the whole tree, or the
# port stays taken by an orphaned next process
descendants() {
  local child
  for child in $(pgrep -P "$1"); do
    descendants "$child"
    echo "$child"
  done
}

if ps -p "$PID" > /dev/null 2>&1; then
  TREE="$(descendants "$PID") $PID"
  # shellcheck disable=SC2086 # TREE is a list of PIDs, split on purpose
  kill $TREE 2> /dev/null || true
  sleep 1
  # shellcheck disable=SC2086
  kill -9 $TREE 2> /dev/null || true
  echo "Dev server: Stopped (PID: $PID)"
else
  echo "Dev server: Not running (stale PID file)"
fi

rm -f "$DEV_PID_FILE" "$DEV_PORT_FILE"
