---
name: ci-fix
description: Get a PR's CI green — watch its checks, read the logs of each red one, fix failures the PR's own diff caused, commit, push and watch again; re-run a check once when the failure is flaky infrastructure (rate limit, timeout, network). Stops and reports when a failure is not the PR's fault or after 3 fix rounds. Use when the user says "make CI green", "fix the failing checks", or a PR's checks are red.
argument-hint: '[pr number | pr url]'
---

# CI Fix

Commits and pushes fixes to the PR's branch: running this skill is the
request to do so. It never force-pushes, never merges, never touches `main`.

## Steps

1. **Resolve** the PR: the argument, else the current branch
   (`gh pr view --json number,headRefName`). Work in a checkout of that branch
   with a clean tree; uncommitted changes → stop and say so.

2. **Watch**: `gh pr checks <pr> --watch --interval 20`. All pass → report and
   stop.

3. **Diagnose** each failing check. For a GitHub Actions check:
   `gh run view <run-id> --log-failed | tail -80`. Sort it into one of three:
   - **Caused by the PR**: the failure points at code or files the PR changed
     (`gh pr diff <pr> --name-only`).
   - **Flaky**: HTTP 429, timeouts, network errors, runner or registry
     outages, with nothing pointing at the diff.
   - **Not the PR's**: it also fails on `main`
     (`gh run list --branch main --workflow <name> --limit 3`), or needs a
     secret, a setting or an external service fixed.

4. **Act**:
   - **Flaky** → `gh run rerun <run-id> --failed`, once per check. Fails the
     same way again → treat it as not the PR's.
   - **Not the PR's** → stop and report; do not work around it.
   - **Caused by the PR** → fix it, reproduce the check locally where it can
     be (table below), commit with a conventional message, `git push`, go back
     to step 2.

5. **Stop** after 3 fix rounds, or when a fix fails the same way twice. Report
   what is still red and why.

## This repo's checks

| Check              | Reproduce locally                                                          | Notes                                                                      |
| ------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| MegaLinter         | `bash scripts/agent/format.sh`, or the `megalinter:megalinter-check` skill | Fix with `bash scripts/agent/format-fix.sh` or `megalinter:megalinter-fix` |
| Banner Preview     | `bash scripts/agent/verify.sh <usernames>`                                 | `HTTP 429: Rate limited` is the app's own per-IP limiter → flaky           |
| Lighthouse         | `pnpm build`                                                               | Score drops only matter when the PR touches pages, components or styles    |
| Harness Audit      | `bash scripts/agent/harness-audit.sh`                                      |                                                                            |
| Vercel             | `pnpm build`                                                               | Deployment logs need Vercel access → report the link                       |
| CodeRabbit, triage | —                                                                          | Not code checks: never "fix" them                                          |

## Never

- Force-push, merge, or push to `main`.
- Skip hooks (`--no-verify`), disable a linter or rule, add a suppression
  comment, or edit a workflow to make a check pass — propose those to the user
  instead.
- Re-run a check more than once.

## Output

```text
## CI fix — PR #<n>

Result: green | still red after <n> round(s) | stopped — <reason>
- <check>: <fixed in <sha> | re-run, passed | still failing — <why, link>>
```
