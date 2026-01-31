---
name: build
description: Validate production build
---

# Build Validation

Validate the production build with minimal, token-optimized output.

Run the build validation script which will:

1. Execute `pnpm build`
2. Show OK status with duration, or FAILED with top 5 error lines
3. Return appropriate exit code

Execute: `bash ../build.sh`
