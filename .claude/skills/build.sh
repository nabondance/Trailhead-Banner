#!/bin/bash
# Build skill - Quick build validation with minimal output
# Usage: /build

set -e

echo "Building..."

# Capture build output and time it
START=$(date +%s)

if OUTPUT=$(pnpm build 2>&1); then
  END=$(date +%s)
  DURATION=$((END - START))
  echo "Build: OK (${DURATION}s)"
else
  # Build failed - show only error lines
  echo "Build: FAILED"
  echo "$OUTPUT" | grep -E "error|Error|✖|Failed|Cannot" | head -5 || echo "$OUTPUT" | tail -10
  exit 1
fi
