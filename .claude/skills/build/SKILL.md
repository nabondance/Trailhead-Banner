---
name: build
description: Validate production build
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/build/build.sh)
  - Bash(bash .claude/skills/build/build.sh)
---

# Build Validation

Validate the production build with minimal, token-optimized output.

Run the build validation script which will:

1. Execute `pnpm build`
2. Show OK status with duration, or FAILED with top 5 error lines
3. Return appropriate exit code

Execute the build script from the project root:

```bash
bash .claude/skills/build/build.sh
```
