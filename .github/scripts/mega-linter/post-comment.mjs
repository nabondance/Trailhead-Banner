import { existsSync, lstatSync, readFileSync } from 'fs';
import { join } from 'path';
import { findPullRequestNumber, upsertComment } from '../shared/github-pr.mjs';

// Runs from the default branch (workflow_run), with a write token. The report
// was produced by a MegaLinter run on pull request code, possibly from a fork:
// treat it as untrusted text. It is only read and posted, never executed.

const SENTINEL = '<!-- megalinter-comment -->';
// GitHub rejects comments above 65536 characters
const MAX_REPORT_CHARS = 60000;
const MAX_REPORT_BYTES = 1024 * 1024;

const artifactDir = process.env.ARTIFACT_DIR;
const reportPath = artifactDir ? join(artifactDir, 'megalinter-reports', 'megalinter-report.md') : null;

if (!reportPath || !existsSync(reportPath) || !lstatSync(reportPath).isFile()) {
  console.log('No MegaLinter report found, skipping comment');
  process.exit(0);
}

const runUrl = process.env.RUN_URL;
const headSha = process.env.HEAD_SHA;
const headOwner = process.env.HEAD_OWNER;
const headBranch = process.env.HEAD_BRANCH;
const sha = headSha?.slice(0, 7) ?? 'unknown';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repo) {
  console.error('ERROR: GITHUB_REPOSITORY is not set');
  process.exit(1);
}
if (!headSha || !headOwner || !headBranch) {
  console.error('ERROR: HEAD_SHA, HEAD_OWNER and HEAD_BRANCH are required');
  process.exit(1);
}
if (lstatSync(reportPath).size > MAX_REPORT_BYTES) {
  console.error('ERROR: MegaLinter report is too large');
  process.exit(1);
}

// Drop HTML comments (sentinels of this or other bot comments) and defuse
// @mentions, so a hand-written report cannot hijack a comment or ping people
let report = readFileSync(reportPath, 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replaceAll('<!--', '&lt;!--')
  .replace(/@(?=\w)/g, '@\u200b')
  .trim();
if (report.length > MAX_REPORT_CHARS) {
  report = `${report.slice(0, MAX_REPORT_CHARS)}\n\n_Report truncated, see the workflow run for the full version._`;
}

try {
  const prNumber = await findPullRequestNumber({ repo, token, headOwner, headBranch, headSha });
  if (!prNumber) {
    console.log(`No open pull request at ${sha} for ${headOwner}:${headBranch} (closed or updated), skipping comment`);
    process.exit(0);
  }
  console.log(`Posting MegaLinter report on PR #${prNumber}`);

  // Report last: if truncation leaves a code block or <details> open, nothing follows it
  const body = `${SENTINEL}\nCommit \`${sha}\` · [Workflow run](${runUrl})\n\n${report}\n`;
  await upsertComment({ repo, token, prNumber, sentinel: SENTINEL, body });
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
