import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { put } from '@vercel/blob';

let usernames, defaultOptions, configs, companyBanner;
try {
  ({ usernames, defaultOptions, configs, companyBanner } = JSON.parse(
    readFileSync(new URL('../../banner-preview.config.json', import.meta.url))
  ));
} catch (err) {
  console.error(`ERROR: Failed to load banner-preview.config.json: ${err.message}`);
  process.exit(1);
}

const prNumber = process.env.PR_NUMBER;
const runId = process.env.RUN_ID;

if (!prNumber || !/^\d+$/.test(prNumber)) {
  console.error(`ERROR: PR_NUMBER is missing or invalid: "${prNumber}"`);
  process.exit(1);
}
if (!runId) {
  console.error('ERROR: RUN_ID is missing');
  process.exit(1);
}

const results = [];

async function callApi(path, body, timeoutMs = 45000) {
  const res = await fetch(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 200)}`);
  }

  const data = JSON.parse(rawText);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || data.message}`);
  return data;
}

function callBannerApi(username, options) {
  return callApi('/api/banner/standard', { username, ...options });
}

function extractPngBuffer(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image/')) {
    throw new Error(`Unexpected imageUrl format: ${String(imageUrl).slice(0, 80)}`);
  }
  return Buffer.from(imageUrl.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
}

// Repo root is 3 levels up from .github/scripts/banner-preview/
const repoRoot = new URL('../../../', import.meta.url).pathname;

for (const username of usernames) {
  let options = configs[username] ?? defaultOptions;
  const configLabel = configs[username] ? username : 'default';
  console.log(`Generating banner for: ${username} (config: ${configLabel})`);
  if (options._description) console.log(`  → ${options._description}`);

  // Inject base64 data URL for upload backgrounds
  if (options._backgroundLocalFile) {
    const filePath = join(repoRoot, options._backgroundLocalFile);
    const base64 = readFileSync(filePath).toString('base64');
    const ext = options._backgroundLocalFile.split('.').pop().toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    const mime = mimeMap[ext] ?? 'image/png';
    options = { ...options, backgroundImageUrl: `data:${mime};base64,${base64}` };
    console.log(`  Injected local file as base64: ${options._backgroundLocalFile}`);
  }

  // Strip private config fields (prefixed with _) before sending to API
  const apiOptions = Object.fromEntries(Object.entries(options).filter(([k]) => !k.startsWith('_')));

  try {
    // First call — expected cache miss
    const first = await callBannerApi(username, apiOptions);
    const firstMs = first.timings?.total_ms ?? null;
    const firstGraphqlMs = first.timings?.graphql_queries_ms ?? null;
    const firstCacheHits = first.timings?.cache_summary?.cache_hits ?? null;
    console.log(`  1st call: ${firstMs}ms total, ${firstGraphqlMs}ms graphql (${firstCacheHits} cache hits)`);

    // Second call — expected cache hit
    const second = await callBannerApi(username, apiOptions);
    const secondMs = second.timings?.total_ms ?? null;
    const secondGraphqlMs = second.timings?.graphql_queries_ms ?? null;
    const secondCacheHits = second.timings?.cache_summary?.cache_hits ?? null;
    const secondTotalQueries = second.timings?.cache_summary?.total_queries ?? null;
    console.log(`  2nd call: ${secondMs}ms total, ${secondGraphqlMs}ms graphql (${secondCacheHits} cache hits)`);

    const warnings = second.warnings || [];

    // Upload the second (cached) banner image
    const pngBuffer = extractPngBuffer(second.imageUrl);
    const blobPath = `pr-previews/${prNumber}/${runId}/${username}.png`;

    console.log(`  Uploading to blob: ${blobPath}`);
    const blob = await put(blobPath, pngBuffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/png',
    });

    console.log(`  OK → ${blob.url}`);
    results.push({
      username,
      status: 200,
      warnings,
      timings_ms: firstMs,
      cached_timings_ms: secondMs,
      graphql_ms: firstGraphqlMs,
      cached_graphql_ms: secondGraphqlMs,
      cache_hits: secondCacheHits,
      cache_total: secondTotalQueries,
      blobUrl: blob.url,
    });
  } catch (err) {
    console.log(`  EXCEPTION: ${err.message}`);
    results.push({ username, status: null, error: err.message });
  }

  // Small delay to avoid Trailhead rate limiting
  await new Promise((r) => setTimeout(r, 1000));
}

// Company banner — one team-level generation exercising /api/banner/company
let companyResult = null;
if (companyBanner?.usernames?.length) {
  const teamUsernames = companyBanner.usernames;
  const companyOptions = Object.fromEntries(
    Object.entries(companyBanner.options ?? {}).filter(([k]) => !k.startsWith('_'))
  );
  console.log(`Generating company banner for: ${teamUsernames.join(', ')}`);
  if (companyBanner.options?._description) console.log(`  → ${companyBanner.options._description}`);

  try {
    // Fetching N users server-side is slower than a single-user banner
    const callCompanyApi = () =>
      callApi('/api/banner/company', { usernames: teamUsernames, options: companyOptions }, 120000);

    // First call — expected cache miss
    const first = await callCompanyApi();
    console.log(
      `  1st call: ${first.timings?.total_ms}ms total, ${first.timings?.fetch_ms}ms fetch, ${first.timings?.image_generation_ms}ms image`
    );

    // Second call — expected Redis cache hit on the GraphQL queries
    const second = await callCompanyApi();
    console.log(
      `  2nd call: ${second.timings?.total_ms}ms total, ${second.timings?.fetch_ms}ms fetch, ${second.timings?.image_generation_ms}ms image`
    );

    if (companyOptions.generateCsv && (!second.csvData || !second.productCsvData)) {
      throw new Error('CSV generation was requested but csvData/productCsvData is missing from the response');
    }

    const pngBuffer = extractPngBuffer(second.imageUrl);
    const blobPath = `pr-previews/${prNumber}/${runId}/company.png`;

    console.log(`  Uploading to blob: ${blobPath}`);
    const blob = await put(blobPath, pngBuffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/png',
    });

    console.log(`  OK → ${blob.url}`);
    companyResult = {
      usernames: teamUsernames,
      status: 200,
      warnings: second.warnings || [],
      failedUsers: second.failedUsers || [],
      timings_ms: first.timings?.total_ms ?? null,
      cached_timings_ms: second.timings?.total_ms ?? null,
      fetch_ms: first.timings?.fetch_ms ?? null,
      cached_fetch_ms: second.timings?.fetch_ms ?? null,
      csv_generated: !!(second.csvData && second.productCsvData),
      blobUrl: blob.url,
    };
  } catch (err) {
    console.log(`  EXCEPTION: ${err.message}`);
    companyResult = { usernames: teamUsernames, status: null, error: err.message };
  }
}

writeFileSync('/tmp/banner-results.json', JSON.stringify({ standard: results, company: companyResult }, null, 2));
console.log('Results written to /tmp/banner-results.json');
