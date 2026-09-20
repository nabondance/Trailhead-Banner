#!/bin/bash
# PreCompact hook - Summarize work state before context compaction
# Output is shown to Claude so it can include key context in the compaction summary

BRANCH=$(git branch --show-current 2> /dev/null || echo 'unknown')
CHANGES=$(git status --short 2> /dev/null)
CHANGE_COUNT=$(echo "$CHANGES" | grep -c . 2> /dev/null || echo 0)

echo "=== Pre-Compaction Work State ==="
echo "Branch: $BRANCH"

if [ "$CHANGE_COUNT" -gt 0 ]; then
  echo "Uncommitted files ($CHANGE_COUNT):"
  echo "$CHANGES"
else
  echo "Working tree: clean"
fi

echo ""
echo "Recent commits:"
git log --oneline -5 2> /dev/null

echo ""
echo "Modified since last commit:"
git diff --stat HEAD 2> /dev/null | tail -5
