import { existsSync, lstatSync, readFileSync } from 'fs';
import { join } from 'path';
import { put } from '@vercel/blob';
import { findPullRequestNumber, upsertComment } from '../shared/github-pr.mjs';

// Runs from the default branch (workflow_run), with secrets. Everything in the
// artifact was produced by pull request code, possibly from a fork: treat it as
// untrusted data. Never execute it, and only read the fields/files expected.

const SENTINEL = '<!-- banner-preview-comment -->';
const MAX_PNG_BYTES = 5 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const artifactDir = process.env.ARTIFACT_DIR;
const resultsPath = artifactDir ? join(artifactDir, 'results.json') : null;

if (!resultsPath || !existsSync(resultsPath)) {
  console.log('No results file found, skipping publish');
  process.exit(0);
}

const runUrl = process.env.RUN_URL;
const runId = process.env.RUN_ID;
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
if (!runId || !/^\d+$/.test(runId)) {
  console.error(`ERROR: RUN_ID is missing or invalid: "${runId}"`);
  process.exit(1);
}
if (!headSha || !headOwner || !headBranch) {
  console.error('ERROR: HEAD_SHA, HEAD_OWNER and HEAD_BRANCH are required');
  process.exit(1);
}

// Resolved from the workflow_run event, never from the artifact
let prNumber;
try {
  prNumber = await findPullRequestNumber({ repo, token, headOwner, headBranch, headSha });
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}

if (!prNumber) {
  console.log(`No open pull request at ${sha} for ${headOwner}:${headBranch} (closed or updated), skipping publish`);
  process.exit(0);
}
console.log(`Publishing banner preview for PR #${prNumber}`);

// Fork runs get no secrets: the preview server had no Redis or Blob credentials
const isFork = headOwner.toLowerCase() !== repo.split('/')[0].toLowerCase();

let allowedUsernames, companyUsernames;
try {
  const { usernames, companyBanner } = JSON.parse(
    readFileSync(new URL('../../banner-preview.config.json', import.meta.url))
  );
  allowedUsernames = new Set(usernames);
  companyUsernames = Array.isArray(companyBanner?.usernames) ? companyBanner.usernames : [];
} catch (err) {
  console.error(`ERROR: Failed to load banner-preview.config.json: ${err.message}`);
  process.exit(1);
}

let rawResults;
try {
  rawResults = JSON.parse(readFileSync(resultsPath, 'utf8'));
} catch (err) {
  console.error(`ERROR: Failed to parse results.json: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(rawResults)) {
  console.error('ERROR: results.json is not an array');
  process.exit(1);
}

// Keep artifact text from breaking out of the comment's table cells / quotes,
// and from adding links, images, HTML or @mentions to a comment posted by the bot
const text = (value) =>
  String(value ?? '')
    .replace(/[\r\n|`<>[\]()!@]/g, ' ')
    .slice(0, 300);
const num = (value) => (Number.isFinite(value) ? value : null);

// Validate a banner image from the artifact before uploading it
function readArtifactPng(name) {
  const filePath = join(artifactDir, name);
  if (!existsSync(filePath) || !lstatSync(filePath).isFile()) throw new Error('banner image is missing');
  if (lstatSync(filePath).size > MAX_PNG_BYTES) throw new Error('banner image is too large');
  const pngBuffer = readFileSync(filePath);
  if (!pngBuffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) throw new Error('banner image is not a PNG');
  return pngBuffer;
}

const results = [];
let uploadFailed = false;
for (const raw of rawResults) {
  const username = raw?.username;
  // Usernames come from the trusted config, so they are safe in paths and markdown
  if (typeof username !== 'string' || !allowedUsernames.has(username)) {
    console.log('Skipping result with a username that is not in banner-preview.config.json');
    continue;
  }
  if (results.some((r) => r.username === username)) continue;

  if (raw.status !== 200) {
    results.push({ username, status: num(raw.status), error: text(raw.error) || 'Unknown error' });
    continue;
  }

  let pngBuffer;
  try {
    pngBuffer = readArtifactPng(`${username}.png`);
  } catch (err) {
    console.log(`  Invalid artifact for ${username}: ${err.message}`);
    results.push({ username, status: null, error: text(err.message) });
    continue;
  }

  try {
    const blobPath = `pr-previews/${prNumber}/${runId}/${username}.png`;
    console.log(`Uploading to blob: ${blobPath}`);
    const blob = await put(blobPath, pngBuffer, {
      access: 'public',
      addRandomSuffix: false,
      // Same path when this workflow or the preview run is re-run
      allowOverwrite: true,
      contentType: 'image/png',
    });
    console.log(`  OK → ${blob.url}`);

    results.push({
      username,
      status: 200,
      warnings: Array.isArray(raw.warnings) ? raw.warnings.slice(0, 20).map(text) : [],
      timings_ms: num(raw.timings_ms),
      cached_timings_ms: num(raw.cached_timings_ms),
      cache_hits: num(raw.cache_hits),
      cache_total: num(raw.cache_total),
      blobUrl: blob.url,
    });
  } catch (err) {
    // Details stay in the workflow log, not in the public comment
    console.error(`  ERROR: Upload failed for ${username}: ${err.message}`);
    results.push({ username, status: null, error: 'Upload to blob storage failed, see the publish workflow logs' });
    uploadFailed = true;
  }
}

// Company banner — the team comes from the trusted config, the result from the artifact
let companyResult = null;
const companyResultsPath = join(artifactDir, 'company-results.json');
if (companyUsernames.length > 0 && existsSync(companyResultsPath)) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(companyResultsPath, 'utf8'));
  } catch (err) {
    raw = { status: null, error: `Failed to parse company-results.json: ${err.message}` };
  }

  if (raw?.status !== 200) {
    companyResult = { status: num(raw?.status), error: text(raw?.error) || 'Unknown error' };
  } else {
    try {
      const pngBuffer = readArtifactPng('company.png');
      const blobPath = `pr-previews/${prNumber}/${runId}/company.png`;
      console.log(`Uploading to blob: ${blobPath}`);
      const blob = await put(blobPath, pngBuffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'image/png',
      });
      console.log(`  OK → ${blob.url}`);
      companyResult = {
        status: 200,
        warnings: Array.isArray(raw.warnings) ? raw.warnings.slice(0, 20).map(text) : [],
        // Only report usernames that are part of the configured team
        failedUsers: Array.isArray(raw.failedUsers) ? raw.failedUsers.filter((u) => companyUsernames.includes(u)) : [],
        timings_ms: num(raw.timings_ms),
        cached_timings_ms: num(raw.cached_timings_ms),
        csv_generated: raw.csv_generated === true,
        blobUrl: blob.url,
      };
    } catch (err) {
      console.error(`  ERROR: Company banner publish failed: ${err.message}`);
      companyResult = { status: null, error: 'Company banner could not be published, see the publish workflow logs' };
      uploadFailed = true;
    }
  }
}

const allResults = companyResult ? [...results, companyResult] : results;
const successCount = allResults.filter((r) => r.status === 200).length;
const errorCount = allResults.length - successCount;

// The 2nd call repeats the 1st one, so every GraphQL query should be served from Redis
const hasCacheMiss = (r) => r.cache_hits != null && r.cache_total != null && r.cache_hits < r.cache_total;
const cacheMissCount = results.filter((r) => r.status === 200 && hasCacheMiss(r)).length;
// Expected on forks, a real problem otherwise
const cacheFailed = cacheMissCount > 0 && !isFork;

const statusIcon = errorCount === allResults.length ? '❌' : errorCount > 0 || cacheFailed ? '⚠️' : '✅';

// Summary table
const tableRows = results.map((r) => {
  if (r.status === 200) {
    const warnText = r.warnings.length > 0 ? `⚠️ ${r.warnings.length}` : '✅ 0';
    const t1 = r.timings_ms != null ? `${r.timings_ms}ms` : '-';
    const t2 = r.cached_timings_ms != null ? `${r.cached_timings_ms}ms` : '-';
    const hitsIcon = hasCacheMiss(r) ? (isFork ? 'ℹ️ ' : '⚠️ ') : '';
    const hits = r.cache_hits != null && r.cache_total != null ? `${hitsIcon}${r.cache_hits}/${r.cache_total}` : '-';
    return `| \`${r.username}\` | ✅ OK | ${t1} | ${t2} | ${hits} | ${warnText} |`;
  }
  return `| \`${r.username}\` | ❌ ${r.status ?? 'ERR'} | - | - | - | - |`;
});

// Per-username image sections
const imageSections = results
  .filter((r) => r.status === 200 && r.blobUrl)
  .map((r) => {
    const warnBlock = r.warnings.length > 0 ? `\n> **Warnings:**\n${r.warnings.map((w) => `> - ${w}`).join('\n')}` : '';
    return `### \`${r.username}\`\n![Banner for ${r.username}](${r.blobUrl})${warnBlock}`;
  });

// Company banner section
let companySection = '';
if (companyResult) {
  const users = companyUsernames.map((u) => `\`${u}\``).join(', ');
  if (companyResult.status === 200) {
    const t1 = companyResult.timings_ms != null ? `${companyResult.timings_ms}ms` : '-';
    const t2 = companyResult.cached_timings_ms != null ? `${companyResult.cached_timings_ms}ms` : '-';
    const csvText = companyResult.csv_generated ? '✅' : '❌';
    const warnText = companyResult.warnings.length > 0 ? `⚠️ ${companyResult.warnings.length}` : '✅ 0';
    const failedText =
      companyResult.failedUsers.length > 0
        ? `⚠️ ${companyResult.failedUsers.map((u) => `\`${u}\``).join(', ')}`
        : '✅ none';
    const warnBlock =
      companyResult.warnings.length > 0
        ? `\n> **Warnings:**\n${companyResult.warnings.map((w) => `> - ${w}`).join('\n')}`
        : '';
    companySection = `## 🏢 Company Banner

Team: ${users}

| Status | 1st call | 2nd call (cached) | CSV | Failed users | Warnings |
|---|---|---|---|---|---|
| ✅ OK | ${t1} | ${t2} | ${csvText} | ${failedText} | ${warnText} |

![Company banner](${companyResult.blobUrl})${warnBlock}
`;
  } else {
    companySection = `## 🏢 Company Banner

Team: ${users}

❌ **Failed:** ${companyResult.error}
`;
  }
}

// Errors section
const errorRows = results
  .filter((r) => r.status !== 200)
  .map((r) => `| \`${r.username}\` | ${r.status ?? 'ERR'} | ${r.error ?? 'Unknown error'} |`);

let body = `${SENTINEL}
## ${statusIcon} Banner Preview

Commit \`${sha}\` · [Workflow run](${runUrl}) · ${successCount}/${allResults.length} generated

| Username | Status | 1st call | 2nd call (cached) | Cache hits | Warnings |
|---|---|---|---|---|---|
${tableRows.join('\n')}
`;

if (cacheMissCount > 0) {
  body += isFork
    ? `\n> [!NOTE]\n> This pull request comes from a fork, so the preview ran without the Redis and Blob credentials. Missing cache hits and slower calls are expected here and are not caused by the changes.\n`
    : `\n> [!WARNING]\n> ${cacheMissCount}/${successCount} banners were not fully served from the Redis cache on the 2nd call. Check the cache credentials and the changes touching the GraphQL cache.\n`;
}

if (imageSections.length > 0) {
  body += `\n---\n\n${imageSections.join('\n\n---\n\n')}\n`;
}

if (companySection) {
  body += `\n---\n\n${companySection}`;
}

if (errorRows.length > 0) {
  body += `\n### ❌ Errors\n\n| Username | Status | Message |\n|---|---|---|\n${errorRows.join('\n')}\n`;
}

try {
  await upsertComment({ repo, token, prNumber, sentinel: SENTINEL, body });
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}

// Fail after posting the comment: this workflow is not a PR check, a green run
// with no banner published would go unnoticed
if (uploadFailed) {
  console.error('ERROR: At least one banner could not be uploaded');
  process.exitCode = 1;
}
