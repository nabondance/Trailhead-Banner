---
name: dev-start
description: Start dev server in background
---

# Dev Server Start

Start the Next.js development server in the background with zero output until ready.

Run the dev server start script which will:

1. Check if dev server is already running
2. Start `pnpm dev` in background if not running
3. Wait for server to be ready, on the first free port from 3000 (saved in `.dev-server.port`, so worktrees do not share a server)
4. Show minimal confirmation when ready

Execute from the repository root: `bash scripts/agent/dev-start.sh`
