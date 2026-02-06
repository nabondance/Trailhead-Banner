---
name: dev-stop
description: Stop background dev server
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/dev-stop/dev-stop.sh)
  - Bash(bash .claude/skills/dev-stop/dev-stop.sh)
---

# Dev Server Stop

Stop the background Next.js development server cleanly.

Run the dev server stop script which will:

1. Find the dev server process
2. Terminate it gracefully
3. Clean up any related processes
4. Show minimal confirmation

Execute the dev-stop script from the project root:

```bash
bash .claude/skills/dev-stop/dev-stop.sh
```
