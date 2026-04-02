#!/bin/bash
# SessionStart hook for Trailhead-Banner

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules missing — run: pnpm install"
fi

# Environment
NODE=$(node --version 2>/dev/null || echo 'not found')
PNPM=$(pnpm --version 2>/dev/null || echo 'not installed')
echo "Env: node $NODE | pnpm $PNPM"

# Git status
BRANCH=$(git branch --show-current 2>/dev/null || echo 'unknown')
CHANGES=$(git status --short 2>/dev/null | wc -l)
if [ "$CHANGES" -gt 0 ]; then
  echo "Git: $BRANCH ($CHANGES uncommitted files)"
else
  echo "Git: $BRANCH (clean)"
fi
