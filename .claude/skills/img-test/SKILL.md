---
name: img-test
description: Test image generation API with optional username (default nabondance)
---

Test the image generation API endpoint with a Trailhead username.

Run the image test script which will:

1. Check if dev server is running (required)
2. Call POST /api/generate-image with username (default: nabondance)
3. Show response status, timing, and key details
4. Validate image generation succeeded

Usage: `/img-test` (uses default username) or `/img-test <username>`

Execute: `bash ../img-test.sh "$@"`
