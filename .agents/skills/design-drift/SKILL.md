---
name: design-drift
description: Report where the code no longer matches the design docs or READMEs it is supposed to follow. Wraps the EGM plugin's /egm:egm-drift-report so it can be picked automatically. Use when the user asks whether docs/ is still accurate, or to check docs against code.
---

# Design drift (EGM wrapper)

Runs the `egm-drift-report` skill of the [EGM plugin](https://github.com/google/elephant-goldfish-model).
The plugin marks its skills user-only, so they are never picked automatically;
this wrapper loads it by hand, which the plugin's own docs allow.

1. **Confirm** in one line unless the user named EGM or this skill: it starts
   several reviewer agents and writes files to `docs/egm/`.
2. **Locate** the plugin skill:
   - Claude Code: the newest
     `~/.claude/plugins/cache/egm/egm/*/skills/egm-drift-report/SKILL.md`.
   - Codex: `skills/egm-drift-report/SKILL.md` of the installed `egm` plugin, from the
     skill inventory.
   - Not found → stop and give the install commands from `AGENTS.md`.
3. **Plugin root** is three directories above that `SKILL.md`. Read every
   `${CLAUDE_PLUGIN_ROOT}` and plugin-relative path (`agents/`, `docs/`,
   `resources/`) against it.
4. **Follow** that `SKILL.md` in this thread, starting with the integration doc
   it names. Never call it through the Skill tool: the tool refuses user-only
   skills.
