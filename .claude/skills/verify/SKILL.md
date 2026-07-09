---
name: verify
description: End-to-end verification - production build + banner generation tests (optional usernames, default nabondance)
---

# Verify

Full end-to-end check that the current code works. Run before committing non-trivial changes.

The script will:

1. Stop any running dev server (a production build breaks a running dev server)
2. Run the production build (`pnpm build`)
3. Start a fresh dev server in background
4. Test banner generation (POST /api/banner/standard) for each username (default: nabondance)
5. Stop the dev server and print a PASS/FAIL summary

Usage: `/verify` (default username) or `/verify <username> [username...]`

Execute: `bash .claude/skills/verify.sh "$@"`
