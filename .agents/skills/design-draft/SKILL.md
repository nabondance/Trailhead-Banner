---
name: design-draft
description: Write a design doc from a brainstorm brief or a feature description, following the EGM design-doc standard. Wraps the EGM plugin's /egm:egm-draft so it can be picked automatically. Use when the user asks for a design doc, technical design or RFC for a feature.
---

# Design draft (EGM wrapper)

Runs the `egm-draft` skill of the [EGM plugin](https://github.com/google/elephant-goldfish-model).
The plugin marks its skills user-only, so they are never picked automatically;
this wrapper loads it by hand, which the plugin's own docs allow.

1. **Confirm** in one line unless the user named EGM or this skill: it starts
   several reviewer agents and writes files to `docs/egm/`.
2. **Locate** the plugin skill:
   - Claude Code: the newest
     `~/.claude/plugins/cache/egm/egm/*/skills/egm-draft/SKILL.md`.
   - Codex: `skills/egm-draft/SKILL.md` of the installed `egm` plugin, from the
     skill inventory.
   - Not found → stop and give the install commands from `AGENTS.md`.
3. **Plugin root** is three directories above that `SKILL.md`. Read every
   `${CLAUDE_PLUGIN_ROOT}` and plugin-relative path (`agents/`, `docs/`,
   `resources/`) against it.
4. **Follow** that `SKILL.md` in this thread, starting with the integration doc
   it names. Never call it through the Skill tool: the tool refuses user-only
   skills.
