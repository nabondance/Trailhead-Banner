---
name: context-budget
description: Audit token costs of the .claude/ setup — skills, agents, hooks, and CLAUDE.md. Shows what's always loaded vs on-demand, flags bloat, and suggests cuts.
---

# Context Budget Audit

Run the audit script and report findings:

Execute: `bash ../context-budget.sh`

Then analyze the output:

1. **Classify each item**
   - Always loaded: hook outputs (SessionStart), CLAUDE.md
   - On invocation: skill SKILL.md files (when `/skill` called)
   - On Agent spawn: full agent .md body

2. **Flag if over budget**
   - CLAUDE.md > 500 tokens → summarize or split
   - Any single skill > 200 tokens → trim
   - Agent description line > 50 tokens → shorten
   - SessionStart output > 100 tokens → slim hook script

3. **Report format**

   ```text
   ALWAYS LOADED
     CLAUDE.md          ~XXX tokens
     SessionStart.sh    ~XX tokens (estimated output)

   ON INVOCATION (skills)
     /build             ~XX tokens
     /format            ~XX tokens
     ...

   ON AGENT SPAWN
     graphql-explorer   ~XXX tokens

   TOTAL LOADED AT REST: ~XXX tokens
   RECOMMENDATIONS: ...
   ```
