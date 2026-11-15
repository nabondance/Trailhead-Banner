#!/bin/bash
# Regenerate the gallery example banners (public/assets/examples/*.webp)
# from src/data/examples.json, then review them in the PR diff.
# Usage: bash scripts/agent/gallery-refresh.sh [id ...]   (no ids = all examples)
# Requires: Dev server running on localhost:3000 (bash scripts/agent/dev-start.sh)

set -e

if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "ERROR: No server running on localhost:3000"
  echo "Start with: bash scripts/agent/dev-start.sh"
  exit 1
fi

node scripts/agent/gallery-refresh.mjs "$@"
