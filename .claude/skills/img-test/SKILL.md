---
name: img-test
description: Test image generation API with optional username (default nabondance)
argument-hint: "[username]"
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/img-test/img-test.sh *)
  - Bash(bash .claude/skills/img-test/img-test.sh)
---

# Image Generation Test

Test the image generation API endpoint with a Trailhead username.

Run the image test script which will:

1. Check if dev server is running (required)
2. Call POST /api/banner/standard with username (default: nabondance)
3. Show response status, timing, and key details
4. Validate image generation succeeded

Usage: `/img-test` (uses default username) or `/img-test <username>`

Execute the img-test script from the project root:

```bash
bash .claude/skills/img-test/img-test.sh $ARGUMENTS
```
