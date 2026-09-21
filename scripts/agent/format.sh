#!/bin/bash
# Check formatting without modifying files
# Usage: bash scripts/agent/format.sh

set -e

echo "Checking format..."

# Run prettier check (suppress success output, show only errors)
if pnpm format:prettier > /dev/null 2>&1; then
  PRETTIER_STATUS="OK"
else
  PRETTIER_STATUS="ISSUES"
  pnpm format:prettier 2>&1 | grep -E "error|Error|✖|Code style issues" | head -3 || true
fi

# Run stylelint check (suppress success output, show only errors)
if pnpm format:stylelint > /dev/null 2>&1; then
  STYLELINT_STATUS="OK"
else
  STYLELINT_STATUS="ISSUES"
  pnpm format:stylelint 2>&1 | grep -E "error|Error|✖|problem" | head -3 || true
fi

# Summary (token-optimized)
echo "Prettier: $PRETTIER_STATUS | Stylelint: $STYLELINT_STATUS"

# Exit with error if any failed
if [ "$PRETTIER_STATUS" = "ISSUES" ] || [ "$STYLELINT_STATUS" = "ISSUES" ]; then
  echo "Run bash scripts/agent/format-fix.sh to auto-fix issues"
  exit 1
fi
