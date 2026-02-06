---
name: dev-start
description: Start dev server in background
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/dev-start/dev-start.sh)
  - Bash(bash .claude/skills/dev-start/dev-start.sh)
---

# Dev Server Start

Start the Next.js development server in the background with zero output until ready.

Run the dev server start script which will:

1. Check if dev server is already running
2. Start `pnpm dev` in background if not running
3. Wait for server to be ready (polls <http://localhost:3000>)
4. Show minimal confirmation when ready

Execute the dev-start script from the project root:

```bash
bash .claude/skills/dev-start/dev-start.sh
```
