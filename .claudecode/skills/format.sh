#!/bin/bash
# Format skill - Run prettier and stylelint with minimal output
# Usage: /format

set -e

echo "Formatting..."

# Run prettier (suppress success output, show only errors)
if pnpm format:prettier:fix > /dev/null 2>&1; then
  PRETTIER_STATUS="OK"
else
  PRETTIER_STATUS="FAILED"
  pnpm format:prettier:fix 2>&1 | grep -E "error|Error|✖" || true
fi

# Run stylelint (suppress success output, show only errors)
if pnpm format:stylelint:fix > /dev/null 2>&1; then
  STYLELINT_STATUS="OK"
else
  STYLELINT_STATUS="FAILED"
  pnpm format:stylelint:fix 2>&1 | grep -E "error|Error|✖" || true
fi

# Summary (token-optimized)
echo "Prettier: $PRETTIER_STATUS | Stylelint: $STYLELINT_STATUS"

# Exit with error if any failed
if [ "$PRETTIER_STATUS" = "FAILED" ] || [ "$STYLELINT_STATUS" = "FAILED" ]; then
  exit 1
fi
