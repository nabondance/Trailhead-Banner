---
name: format-fix
description: Auto-fix code formatting issues (prettier + stylelint)
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/format-fix/format-fix.sh)
  - Bash(bash .claude/skills/format-fix/format-fix.sh)
---

# Format Fix

Automatically fix code formatting issues using prettier and stylelint.

Run the format fix script which will:

1. Apply prettier formatting
2. Apply stylelint auto-fixes
3. Show summary of changes made

Execute the format-fix script from the project root:

```bash
bash .claude/skills/format-fix/format-fix.sh
```
