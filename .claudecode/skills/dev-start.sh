#!/bin/bash
# Dev server start skill - Start dev server in background with zero output
# Usage: /dev-start

set -e

echo "Starting dev server..."

# Check if already running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "Dev server: Already running"
  exit 0
fi

# Start dev server in background, suppress all output
nohup pnpm dev > /dev/null 2>&1 &
DEV_PID=$!

# Save PID for later stopping
echo $DEV_PID > .dev-server.pid

# Wait for server to be ready (max 30s)
START=$(date +%s)
READY=false

for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

END=$(date +%s)
DURATION=$((END - START))

if [ "$READY" = true ]; then
  echo "Dev server: Ready (${DURATION}s) | PID: $DEV_PID"
else
  echo "Dev server: TIMEOUT (failed to start in 30s)"
  kill $DEV_PID 2> /dev/null || true
  rm -f .dev-server.pid
  exit 1
fi
