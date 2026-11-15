---
name: design-brainstorm
description: Turn a rough feature idea into a structured brief: clarifying questions, then zero-context Goldfish reviewers stress-test it. Wraps the EGM plugin's /egm:egm-brainstorm so it can be picked automatically. Use when the user wants to brainstorm, shape or challenge a new feature idea before any design or code.
---

# Brainstorm (EGM wrapper)

Runs the `egm-brainstorm` skill of the [EGM plugin](https://github.com/google/elephant-goldfish-model).
The plugin marks its skills user-only, so they are never picked automatically;
this wrapper loads it by hand, which the plugin's own docs allow.

1. **Confirm** in one line unless the user named EGM or this skill: it starts
   several reviewer agents and writes files to `docs/egm/`.
2. **Locate** the plugin skill:
   - Claude Code: the newest
     `~/.claude/plugins/cache/egm/egm/*/skills/egm-brainstorm/SKILL.md`.
   - Codex: `skills/egm-brainstorm/SKILL.md` of the installed `egm` plugin, from the
     skill inventory.
   - Not found → stop and give the install commands from `AGENTS.md`.
3. **Plugin root** is three directories above that `SKILL.md`. Read every
   `${CLAUDE_PLUGIN_ROOT}` and plugin-relative path (`agents/`, `docs/`,
   `resources/`) against it.
4. **Follow** that `SKILL.md` in this thread, starting with the integration doc
   it names. Never call it through the Skill tool: the tool refuses user-only
   skills.
