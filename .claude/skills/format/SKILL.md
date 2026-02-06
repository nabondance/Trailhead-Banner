---
name: format
description: Check code formatting (prettier + stylelint) without modifying files
disable-model-invocation: true
allowed-tools:
  - Bash(bash ~/.claude/skills/format/format.sh)
  - Bash(bash .claude/skills/format/format.sh)
---

# Format Check

Check code formatting using prettier and stylelint without making any changes.

Run the format check script which will:

1. Check prettier formatting
2. Check stylelint rules
3. Show concise summary (OK or ISSUES with top 3 errors)
4. Suggest running /format-fix if issues found

Execute the format check script from the project root:

```bash
bash .claude/skills/format/format.sh
```
