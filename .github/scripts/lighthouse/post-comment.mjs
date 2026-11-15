import { existsSync, lstatSync, readFileSync } from 'fs';
import { join } from 'path';
import { findPullRequestNumber, upsertComment } from '../shared/github-pr.mjs';

// Runs from the default branch (workflow_run), with a write token. The manifest
// was produced by a Lighthouse run on pull request code, possibly from a fork:
// treat it as untrusted data. Only page paths and numeric scores are used.

const SENTINEL = '<!-- lighthouse-comment -->';
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_PAGES = 20;

const CATEGORIES = [
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'best-practices', label: 'Best practices' },
  { key: 'seo', label: 'SEO' },
];

const artifactDir = process.env.ARTIFACT_DIR;
const manifestPath = artifactDir ? join(artifactDir, 'manifest.json') : null;

if (!manifestPath || !existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) {
  console.log('No Lighthouse manifest found, skipping comment');
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
if (lstatSync(manifestPath).size > MAX_MANIFEST_BYTES) {
  console.error('ERROR: Lighthouse manifest is too large');
  process.exit(1);
}

// Keep only a plain local path, so the page column cannot carry markdown or links
function pagePath(url) {
  const match = typeof url === 'string' && url.match(/^http:\/\/localhost:3000(\/[a-z0-9\-/]*)?$/i);
  return match ? match[1] || '/' : null;
}

// Lighthouse colors: green 90+, orange 50-89, red below 50
function formatScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return '–';
  const score = Math.round(value * 100);
  const dot = score >= 90 ? '🟢' : score >= 50 ? '🟠' : '🔴';
  return `${dot} ${score}`;
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`ERROR: Invalid Lighthouse manifest: ${err.message}`);
  process.exit(1);
}

const rows = (Array.isArray(manifest) ? manifest : [])
  .filter((run) => run?.isRepresentativeRun === true)
  .map((run) => ({ path: pagePath(run.url), summary: run.summary ?? {} }))
  .filter((row) => row.path)
  .slice(0, MAX_PAGES);

if (rows.length === 0) {
  console.log('No usable Lighthouse results, skipping comment');
  process.exit(0);
}

const table = [
  `| Page | ${CATEGORIES.map((c) => c.label).join(' | ')} |`,
  `|---|${CATEGORIES.map(() => '---').join('|')}|`,
  ...rows.map((row) => `| \`${row.path}\` | ${CATEGORIES.map((c) => formatScore(row.summary[c.key])).join(' | ')} |`),
].join('\n');

const body = `${SENTINEL}
## Lighthouse

Mobile, median of 3 runs on a local production build · commit \`${sha}\` · [workflow run](${runUrl}) (full reports in the \`lighthouse-reports\` artifact)

${table}
`;

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
