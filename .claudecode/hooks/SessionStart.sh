#!/bin/bash
# SessionStart hook for Trailhead-Banner
# Runs when Claude Code starts a new session

set -e

echo "Trailhead-Banner Development Environment"
echo "========================================="
echo ""

# Critical: Enforce pnpm usage
echo "PACKAGE MANAGER: pnpm (NOT npm/yarn)"
echo "- Install deps: pnpm install"
echo "- Dev server:   pnpm dev"
echo "- Build:        pnpm build"
echo "- Format:       pnpm format:all:fix"
echo ""

# Show versions
echo "Environment:"
echo "- Node: $(node --version 2>/dev/null || echo 'not found')"
echo "- pnpm: $(pnpm --version 2>/dev/null || echo 'not installed')"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules missing. Run: pnpm install"
  echo ""
fi

# Git status (concise)
echo "Git Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
CHANGES=$(git status --short 2>/dev/null | wc -l)
if [ "$CHANGES" -gt 0 ]; then
  echo "Uncommitted changes: $CHANGES files"
else
  echo "Working tree: clean"
fi
echo ""

echo "Ready to code!"
