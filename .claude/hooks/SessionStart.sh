#!/bin/bash
# SessionStart hook for Trailhead-Banner

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules missing — run: pnpm install"
fi

# Git status
BRANCH=$(git branch --show-current 2>/dev/null || echo 'unknown')
CHANGES=$(git status --short 2>/dev/null | wc -l)
if [ "$CHANGES" -gt 0 ]; then
  echo "Git: $BRANCH ($CHANGES uncommitted files)"
else
  echo "Git: $BRANCH (clean)"
fi
