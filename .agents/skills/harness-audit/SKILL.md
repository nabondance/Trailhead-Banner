---
name: harness-audit
description: Check the agent setup for broken links — skills Claude or Codex cannot see, broken symlinks, agents or scripts referenced but missing, file paths in AGENTS.md or skills that no longer exist, hook scripts, output style, EGM plugin layout. Use after adding, renaming or moving a skill, agent, script or source file mentioned in AGENTS.md, or when a skill or agent does not show up.
---

# Harness Audit

Run from the repository root: `bash scripts/agent/harness-audit.sh`

It prints problems only, then a summary line, and exits 1 on any error.

- **ERROR**: fix it before committing. CI runs the same check on pull requests
  that touch the agent setup.
- **WARN**: advisory, for example a skill missing from the list in `AGENTS.md`.

A path that is created on first use, not committed, goes in `createdLater` in
`scripts/agent/harness-audit.mjs`, with nothing else.
