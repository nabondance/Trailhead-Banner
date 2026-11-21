#!/bin/bash
# PreToolUse hook (Bash): refuse `gh pr create` for a UI change whose PR body
# has no `## Screenshots` section. Every other command exits at the first check.
INPUT=$(cat)
case "$INPUT" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac
printf '%s' "$INPUT" | node "$(dirname "$0")/pr-screenshot-guard.mjs" || exit 0
