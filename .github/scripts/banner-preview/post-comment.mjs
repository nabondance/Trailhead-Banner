import { readFileSync, existsSync } from 'fs';

const SENTINEL = '<!-- banner-preview-comment -->';

if (!existsSync('/tmp/banner-results.json')) {
  console.log('No results file found, skipping comment');
  process.exit(0);
}

let results;
try {
  results = JSON.parse(readFileSync('/tmp/banner-results.json', 'utf8'));
} catch (err) {
  console.error(`ERROR: Failed to parse banner-results.json: ${err.message}`);
  process.exit(1);
}

const runUrl = process.env.RUN_URL;
const sha = process.env.SHORT_SHA?.slice(0, 7) ?? 'unknown';
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)/)?.[1];
const token = process.env.GITHUB_TOKEN;

if (!prNumber) {
  console.error(`ERROR: Could not extract PR number from GITHUB_REF: "${process.env.GITHUB_REF}"`);
  process.exit(1);
}
if (!repo) {
  console.error('ERROR: GITHUB_REPOSITORY is not set');
  process.exit(1);
}

const successCount = results.filter((r) => r.status === 200).length;
const errorCount = results.length - successCount;
const statusIcon = errorCount === 0 ? '✅' : errorCount === results.length ? '❌' : '⚠️';

// Summary table
const tableRows = results.map((r) => {
  if (r.status === 200) {
    const warnText = r.warnings.length > 0 ? `⚠️ ${r.warnings.length}` : '✅ 0';
    const t1 = r.timings_ms != null ? `${r.timings_ms}ms` : '-';
    const t2 = r.cached_timings_ms != null ? `${r.cached_timings_ms}ms` : '-';
    const hits = r.cache_hits != null && r.cache_total != null ? `${r.cache_hits}/${r.cache_total}` : '-';
    return `| \`${r.username}\` | ✅ OK | ${t1} | ${t2} | ${hits} | ${warnText} |`;
  }
  return `| \`${r.username}\` | ❌ ${r.status ?? 'ERR'} | - | - | - | - |`;
});

// Per-username image sections
const imageSections = results
  .filter((r) => r.status === 200 && r.blobUrl)
  .map((r) => {
    const warnBlock =
      r.warnings.length > 0
        ? `\n> **Warnings:**\n${r.warnings.map((w) => `> - ${w}`).join('\n')}`
        : '';
    return `### \`${r.username}\`\n![Banner for ${r.username}](${r.blobUrl})${warnBlock}`;
  });

// Errors section
const errorRows = results
  .filter((r) => r.status !== 200)
  .map((r) => `| \`${r.username}\` | ${r.status ?? 'ERR'} | ${r.error ?? 'Unknown error'} |`);

let body = `${SENTINEL}
## ${statusIcon} Banner Preview

Commit \`${sha}\` · [Workflow run](${runUrl}) · ${successCount}/${results.length} generated

| Username | Status | 1st call | 2nd call (cached) | Cache hits | Warnings |
|---|---|---|---|---|---|
${tableRows.join('\n')}
`;

if (imageSections.length > 0) {
  body += `\n---\n\n${imageSections.join('\n\n---\n\n')}\n`;
}

if (errorRows.length > 0) {
  body += `\n### ❌ Errors\n\n| Username | Status | Message |\n|---|---|---|\n${errorRows.join('\n')}\n`;
}

// Find and update existing comment, or post new one
let comments;
try {
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );
  if (!listRes.ok) {
    const errBody = await listRes.text();
    console.error(`ERROR: Failed to list comments (${listRes.status} ${listRes.statusText}): ${errBody}`);
    process.exit(1);
  }
  comments = await listRes.json();
} catch (err) {
  console.error(`ERROR: Network error listing comments: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(comments)) {
  console.error('ERROR: Unexpected response shape when listing comments');
  process.exit(1);
}

const existing = comments.find((c) => c.body?.includes(SENTINEL));

if (existing) {
  const patchRes = await fetch(existing.url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!patchRes.ok) {
    const errBody = await patchRes.text();
    console.error(`ERROR: Failed to update comment (${patchRes.status}): ${errBody}`);
    process.exit(1);
  }
  console.log(`Updated existing comment #${existing.id}`);
} else {
  const postRes = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!postRes.ok) {
    const errBody = await postRes.text();
    console.error(`ERROR: Failed to post comment (${postRes.status}): ${errBody}`);
    process.exit(1);
  }
  console.log('Posted new comment');
}
