---
name: full-review
description: Review a PR or the current branch two ways at once — a zero-context code-goldfish (as in /cold-review) running in the background while this session reviews with full project context, plus the security-reviewer when the diff touches API routes or URL/image handling — then merge the findings into one report, marking where the reviews agree or disagree. Read-only. Use when the user asks for a full, thorough or complete review of a PR or branch.
argument-hint: '[pr number | pr url] [--goal "<what the change should do>"]'
---

# Full Review

Read-only. The report goes to chat; nothing is written to the repo or GitHub.

## Steps

1. **Cold side, in the background.** Follow steps 1–4 of
   [`cold-review`](../cold-review/SKILL.md): resolve the target, build the diff
   file and the detached tree, set the goal, spawn `code-goldfish` with only
   those three things. Do not wait for it.

2. **Security side, only if the diff touches** `src/pages/api/`,
   `src/banner/api/`, `src/utils/urlSafety.js`, `src/utils/imageSafety.js`,
   `src/utils/imageValidation.js`, `src/utils/usernameValidation.js` or
   `src/utils/rateLimit.js`: spawn the `security-reviewer` agent in the same
   message. Its prompt gives the diff path and the tree path, and says to
   review only the changes in that diff, to read and cite files under the tree
   only (never the current checkout, which is another branch), and to return
   at most 5 findings in the `file:line — trigger → what goes wrong → fix`
   form. Otherwise skip it.

3. **Context side, in this session, while they run.** Read the diff file and the
   changed files in the tree. Do not read any agent output yet: the context
   review must stand on its own. Check:
   - Defects: wrong result, crash, data loss, a broken caller.
   - Project rules from `AGENTS.md`: banner component contract (`prepare*`,
     `render*`, `get*Warnings`, `get*Timings`), the Common Pitfalls list, page
     `metadata` plus `sitemap.js` and `llms.js` updates for new pages, Redis
     caching of new Trailhead queries, `docs/banner-components.md` for banner
     code.
   - Repo fit: an existing helper the change duplicates; a doc in `docs/` or
     `AGENTS.md` the change makes wrong.

   Same bar as the goldfish: `file:line` in the tree, the trigger, what goes
   wrong, a one-line fix; `blocking`, `should-fix` or `nit`. At most 7.

4. **Merge**, once every agent has returned:
   - Same line (±3) and same failure from two sources → one finding, tagged
     with both.
   - A cold or security finding that project context shows is handled → keep
     it, add `(ctx: handled at <path>:<line>)`. Never drop one silently.
   - Most severe first.

5. **Clean up, always:** step 5 of `cold-review`.

## Output

```
## Full review — PR #<n> | <branch> @ <short sha>

Goal: <issue title (#n) | --goal | none>
Context: <n | clear> · Cold: <n | clear | not run — reason> · Security: <n | clear | skipped>
🔴|🟠|💭 [ctx|cold|sec|ctx+cold|…] <path>:<line> — <trigger → what goes wrong> → fix: <one line>
```

Cold and security findings keep the agent's wording. Open each cited
`file:line` in the tree before cleanup; add `(anchor not found)` where the line
does not exist.
