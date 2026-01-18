#!/bin/bash
# Format fix skill - Auto-fix formatting issues
# Usage: /format-fix

set -e

echo "Fixing format..."

# Run prettier fix (suppress success output, show only errors)
if pnpm format:prettier:fix > /dev/null 2>&1; then
  PRETTIER_STATUS="FIXED"
else
  PRETTIER_STATUS="FAILED"
  pnpm format:prettier:fix 2>&1 | grep -E "error|Error|✖" | head -3 || true
fi

# Run stylelint fix (suppress success output, show only errors)
if pnpm format:stylelint:fix > /dev/null 2>&1; then
  STYLELINT_STATUS="FIXED"
else
  STYLELINT_STATUS="FAILED"
  pnpm format:stylelint:fix 2>&1 | grep -E "error|Error|✖" | head -3 || true
fi

# Summary (token-optimized)
echo "Prettier: $PRETTIER_STATUS | Stylelint: $STYLELINT_STATUS"

# Exit with error if any failed
if [ "$PRETTIER_STATUS" = "FAILED" ] || [ "$STYLELINT_STATUS" = "FAILED" ]; then
  exit 1
fi
