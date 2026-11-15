// Reads a PreToolUse hook payload on stdin. When the Bash command opens a PR
// whose branch changes UI files and its body has no screenshots section, it
// denies the call with the reason. Any failure here allows the call: a broken
// guard must never block work.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const UI_FILE = /^(src\/(app|components|styles)\/|public\/)|\.css$/;
const NOT_UI = /(^|\/)(route|sitemap|robots|manifest)\.js$/;
const SECTION = /#{2,3}[ \t]*(screenshots|visual check)\b/i;

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const command = input.tool_input?.command ?? '';
  if (!/\bgh\s+pr\s+create\b/.test(command)) process.exit(0);

  // `cd <dir> && gh pr create ...` runs in <dir>
  let cwd = input.cwd || process.cwd();
  const cd = command.match(/(?:^|&&|;)\s*cd\s+(["']?)([^"'&;]+)\1\s*(?:&&|;)/);
  if (cd) cwd = path.resolve(cwd, cd[2].trim().replace(/^~/, process.env.HOME));

  // The body is either in the command (--body, heredoc) or in a --body-file
  let body = command;
  const bodyFile = command.match(/--body-file[=\s]+(["']?)([^"'\s]+)\1/)?.[2];
  if (bodyFile && bodyFile !== '-') body += fs.readFileSync(path.resolve(cwd, bodyFile), 'utf8');
  if (SECTION.test(body)) process.exit(0);

  const base = command.match(/--base[=\s]+(["']?)([^"'\s]+)\1/)?.[2] ?? 'main';
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const changed = git('diff', '--name-only', git('merge-base', `origin/${base}`, 'HEAD'), 'HEAD')
    .split('\n')
    .filter((f) => UI_FILE.test(f) && !NOT_UI.test(f));
  if (changed.length === 0) process.exit(0);

  const shown = changed.slice(0, 5).join(', ') + (changed.length > 5 ? `, +${changed.length - 5} more` : '');
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `This PR changes UI files (${shown}) but its body has no "## Screenshots" section. ` +
          'Add one with screenshots of the changed pages (desktop and mobile), or the pages to ' +
          'check on the Vercel preview, or "n/a — <why nothing visible changed>", then retry.',
      },
    })
  );
} catch {
  process.exit(0);
}
