---
name: cold-review
description: Zero-context review of a PR or of the current branch. Hands the code-goldfish agent only the diff, a clean checkout of the changed code and the linked issue (or a goal you give) — no CLAUDE.md, no AGENTS.md, no PR description, no conversation — and prints its findings, each citing file:line. Read-only. Use when the user asks for a cold review, a fresh-eyes review or a goldfish review.
argument-hint: '[pr number | pr url] [--goal "<what the change should do>"]'
---

# Cold Review

Read-only. The output is a report in chat; nothing is written to the repo or
GitHub.

## Steps

1. **Resolve the target.**
   - A PR number or URL: `gh pr view <pr> --json number,headRefOid,title,closingIssuesReferences`.
   - No PR: the current branch against `main`. If `git status --porcelain` is
     not empty, say that uncommitted changes are not part of the review.

2. **Diff and tree**, in one Bash call. The first output line is the work
   folder `<dir>`, printed before anything can fail; the diff is
   `<dir>/change.diff` and the tree `<dir>/tree`. Each Bash call is a fresh
   shell, so later steps use that printed path, never `$d`.
   - PR:
     `d=$(mktemp -d) && echo "$d" && gh pr diff <pr> > "$d/change.diff" && git fetch -q origin "pull/<pr>/head" && git worktree add -q --detach "$d/tree" FETCH_HEAD`
   - Branch:
     `d=$(mktemp -d) && echo "$d" && git fetch -q origin main && git diff "$(git merge-base origin/main HEAD)" HEAD > "$d/change.diff" && git worktree add -q --detach "$d/tree" HEAD`

   An empty diff → say so and go to step 5. Any other failure → report its
   stderr and go to step 5.

3. **Goal**, in this order:
   - `--goal` text, verbatim.
   - The PR's linked issues: `gh issue view <n> --json title,body` for each,
     title and body verbatim.
   - Otherwise `none — no goal given; use the Defects lens only`.

   Never use the PR description, commit messages or this conversation as the
   goal: they carry the author's intent, which the review must not see.

4. **Spawn** the `code-goldfish` agent. The prompt holds three things and
   nothing else: the diff path, the tree path, and the goal. No summary of the
   change, no opinion, no hint of what to look for.
   - Claude Code: the `Agent` tool with `subagent_type: code-goldfish`
     (`.claude/agents/code-goldfish.md`).
   - Codex: `spawn_agent` with `agent_type: code-goldfish`
     (`.codex/agents/code-goldfish.toml`) and `fork_turns: "none"` (or
     `fork_context: false` on versions that expose that instead), then wait
     for it. Never let it inherit this conversation.
   - If the agent type is not available, stop with
     `Cold review: not run — code-goldfish agent not loaded (start a new session)`.
     A review in this context is not a cold review.

5. **Clean up, always**, even after a failure, with the `<dir>` printed in
   step 2 written out literally:
   `git worktree remove --force "<dir>/tree"; rm -rf "<dir>"`.
   No `<dir>` was printed → nothing to clean.

## Output

```text
## Cold review — PR #<n> | <branch> @ <short sha>

Goal: <issue title (#n) | --goal | none>
Goldfish: <clear | findings>
🔴|🟠|💭 <path>:<line> — <the agent's text, word for word>
```

`blocking` → 🔴, `should-fix` → 🟠, `nit` → 💭. Do not triage, re-check or
reword the findings. Run one check only: open each cited `file:line` in the
tree before cleanup, and append `(anchor not found)` to a finding whose line
does not exist. A failed agent run → `Cold review: not run — <reason>`.
