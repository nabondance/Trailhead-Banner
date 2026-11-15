import { join } from 'path';
import { findArtifactUrl, findPullRequestNumber, upsertComment } from '../shared/github-pr.mjs';
import { describeRuns, renderScores } from './scores.mjs';

// Runs from the default branch (workflow_run), with a write token. The manifest
// was produced by a Lighthouse run on pull request code, possibly from a fork:
// treat it as untrusted data (see scores.mjs).
//
// Also runs when the manifest is missing or unusable (for example the run
// failed before writing it), to replace scores from an earlier commit with a notice.

const SENTINEL = '<!-- lighthouse-comment -->';

const artifactDir = process.env.ARTIFACT_DIR;
const runUrl = process.env.RUN_URL;
const runId = process.env.RUN_ID;
const headSha = process.env.HEAD_SHA;
const headOwner = process.env.HEAD_OWNER;
const headBranch = process.env.HEAD_BRANCH;
const sha = headSha?.slice(0, 7) ?? 'unknown';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repo || !token) {
  console.error('ERROR: GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  process.exit(1);
}
if (!headSha || !headOwner || !headBranch) {
  console.error('ERROR: HEAD_SHA, HEAD_OWNER and HEAD_BRANCH are required');
  process.exit(1);
}

let scores = null;
try {
  scores = renderScores(artifactDir ? join(artifactDir, 'manifest.json') : null);
} catch (err) {
  console.error(`Could not read the Lighthouse manifest: ${err.message}`);
}

const runLink = runUrl ? ` · [workflow run](${runUrl})` : '';
const reportsUrl = scores ? await findArtifactUrl({ repo, token, runId, name: 'lighthouse-reports' }) : undefined;
const reportsLink = reportsUrl
  ? ` · [download full reports](${reportsUrl})`
  : ' (full reports in the `lighthouse-reports` artifact)';
const content = scores
  ? `${describeRuns(scores.runsPerPage)} · commit \`${sha}\`${runLink}${reportsLink}\n\n${scores.table}`
  : `No Lighthouse scores for commit \`${sha}\`: the run produced no usable results${runLink}.`;
const body = `${SENTINEL}\n## Lighthouse\n\n${content}\n`;

try {
  const prNumber = await findPullRequestNumber({ repo, token, headOwner, headBranch, headSha });
  if (!prNumber) {
    console.log(`No open pull request at ${sha} for ${headOwner}:${headBranch} (closed or updated), skipping comment`);
    process.exit(0);
  }
  console.log(`Posting Lighthouse scores on PR #${prNumber}`);
  await upsertComment({ repo, token, prNumber, sentinel: SENTINEL, body });
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
