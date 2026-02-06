#!/bin/bash
# Dev server stop skill - Stop background dev server
# Usage: /dev-stop

set -e

echo "Stopping dev server..."

# Check if PID file exists
if [ -f .dev-server.pid ]; then
  PID=$(cat .dev-server.pid)

  # Check if process is running
  if ps -p $PID > /dev/null 2>&1; then
    kill $PID 2> /dev/null || true
    # Wait a bit for graceful shutdown
    sleep 1

    # Force kill if still running
    if ps -p $PID > /dev/null 2>&1; then
      kill -9 $PID 2> /dev/null || true
    fi

    echo "Dev server: Stopped (PID: $PID)"
  else
    echo "Dev server: Not running (stale PID file)"
  fi

  rm -f .dev-server.pid
else
  # Try to find and kill by process name
  PIDS=$(pgrep -f "pnpm dev" || true)

  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2> /dev/null || true
    echo "Dev server: Stopped (found by name)"
  else
    echo "Dev server: Not running"
  fi
fi
