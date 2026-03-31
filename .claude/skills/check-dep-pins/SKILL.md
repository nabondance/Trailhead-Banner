---
name: check-dep-pins
description: Audit security-pinned dependency overrides in package.json. Checks whether each pinned version can be safely removed because the natural resolution now satisfies the minimum safe version. Triggered when the user asks to audit, review, or unlock pinned/locked dependencies, or check if overrides are still needed.
---

# Check Dependency Pins

Audit `pnpm.overrides` (or `resolutions` for yarn/npm) to find version pins that were added for security reasons and determine which can now be removed.

## Steps

### 1 — Read current overrides

```bash
cat package.json | jq '.pnpm.overrides // .resolutions // {}'
```

List every entry. Note the **key** (package name + optional version range) and **pinned value**.

### 2 — Check what pnpm would resolve without the pin

For each pinned package, temporarily check what version pnpm actually installs:

```bash
pnpm why < package-name > 2 > /dev/null | grep -E "└──|├──" | grep "<package-name>"
```

This shows the resolved version(s) in the current lockfile (which includes the pin).

### 3 — Check latest published version on npm

```bash
pnpm info < package-name > version 2> /dev/null
```

Or for a specific range:

```bash
pnpm info version < package-name > @"<range>" 2> /dev/null
```

### 4 — Determine if the pin is still needed

For each override, assess:

| Condition                                                                                                  | Action                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Latest version in the requested range is **already >= pinned version**                                     | **Can remove** — pnpm will naturally resolve to a safe version   |
| Latest version is **below pinned version** (upstream hasn't released a fix yet)                            | **Keep pin** — removing it would regress to a vulnerable version |
| Override key uses a version constraint (e.g., `axios@1.14.1`) that no longer matches any installed package | **Dead override** — safe to remove (the constraint never fires)  |

### 5 — Report findings

For each override, output one line:

```text
✅ REMOVE  picomatch@2        pin=2.3.2  latest-in-range=2.3.2  (range already satisfies fix)
🔒 KEEP    some-pkg           pin=1.2.3  latest-in-range=1.2.2  (upstream not yet patched)
🧹 DEAD    axios@1.14.1       pin=1.14.0  (version constraint matches nothing installed)
```

Then list the exact lines to remove from `package.json`.

### 6 — Apply removals (if user confirms)

Use Edit to remove the lines from `package.json` `pnpm.overrides`, then run:

```bash
pnpm install
```

Verify no new vulnerabilities appear after unlocking.

## Notes

- A pin added as `"pkg@X"` (exact upstream version constraint) fires only when that exact version is requested transitively. Check `pnpm why pkg` to confirm it's still relevant.
- A pin added as `"pkg@major"` (e.g., `"picomatch@2"`) overrides **all** v2.x resolutions — remove it only when the natural resolution already picks a version >= the fix.
- After removing overrides, re-run the CI security scan or `pnpm audit` to confirm no regressions.
