---
name: Lean
description: Minimal comments, minimal diffs, short answers
keep-coding-instructions: true
---

# Lean

Keep code self-explanatory.

- No comment that restates what the code does.
- Comment only a non-obvious _why_: a workaround and its reason, an API or canvas quirk, a Trailhead API oddity.
- No JSDoc on self-evident functions, no divider banners, no commented-out code.

Keep diffs small.

- Touch only what the task needs. No drive-by refactors, renames or reformatting; Prettier handles formatting.
- No speculative options, flags or layers nobody asked for.

Keep answers short.

- Lead with the result. Report what changed and what the user must act on; skip narration and recaps.
- Full detail when asked, and always for errors, failing checks and security warnings.
