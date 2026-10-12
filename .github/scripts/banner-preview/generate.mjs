import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

let usernames, defaultOptions, configs;
try {
  ({ usernames, defaultOptions, configs } = JSON.parse(
    readFileSync(new URL('../../banner-preview.config.json', import.meta.url))
  ));
} catch (err) {
  console.error(`ERROR: Failed to load banner-preview.config.json: ${err.message}`);
  process.exit(1);
}

// Banners and results are written here, then uploaded as a workflow artifact.
// Publishing (blob upload + PR comment) happens in banner-preview-publish.yml,
// which has access to secrets even for pull requests coming from forks.
const outputDir = process.env.OUTPUT_DIR || '/tmp/banner-preview';
mkdirSync(outputDir, { recursive: true });

const results = [];
let requiredCaseFailed = false;

async function callBannerApi(username, options) {
  const res = await fetch('http://localhost:3000/api/banner/standard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, ...options }),
    signal: AbortSignal.timeout(45000),
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

function assertSfdxHardisBadge(data, username, callLabel) {
  const badges = data.sfdxHardisBadgesData?.badges;
  if (!Array.isArray(badges) || badges.length === 0) {
    throw new Error(`${callLabel}: expected an sfdx-hardis badge for ${username}`);
  }

  const highest = badges.reduce((current, badge) => (!current || badge.level > current.level ? badge : current), null);
  const trustedBannerImage =
    typeof highest?.bannerImage === 'string' &&
    /^https:\/\/hardisgroupcom\.github\.io\/sfdx-hardis-training\/badges\/img\/banner-level-\d+\.svg$/.test(
      highest.bannerImage
    );

  if (!trustedBannerImage) {
    throw new Error(`${callLabel}: badge has an invalid bannerImage: ${String(highest?.bannerImage)}`);
  }
  if (!(highest.checksTotal > 0 && highest.checksPassed === highest.checksTotal)) {
    throw new Error(`${callLabel}: badge completion checks are not verified`);
  }
  if (data.timings?.sfdx_hardis_badge_timed_out) {
    throw new Error(`${callLabel}: sfdx-hardis integration exceeded its time budget`);
  }
  if (data.timings?.image_generation_breakdown?.sfdx_hardis_badge_level !== highest.level) {
    throw new Error(`${callLabel}: level ${highest.level} badge was returned but not prepared by the renderer`);
  }

  console.log(`  ${callLabel}: verified rendered sfdx-hardis level ${highest.level} (${highest.bannerImage})`);
}

// Repo root is 3 levels up from .github/scripts/banner-preview/
const repoRoot = new URL('../../../', import.meta.url).pathname;

for (const username of usernames) {
  let options = configs[username] ?? defaultOptions;
  const expectSfdxHardisBadge = options._expectSfdxHardisBadge === true;
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
    if (expectSfdxHardisBadge) assertSfdxHardisBadge(first, username, '1st call');

    // Second call — expected cache hit
    const second = await callBannerApi(username, apiOptions);
    const secondMs = second.timings?.total_ms ?? null;
    const secondGraphqlMs = second.timings?.graphql_queries_ms ?? null;
    const secondCacheHits = second.timings?.cache_summary?.cache_hits ?? null;
    const secondTotalQueries = second.timings?.cache_summary?.total_queries ?? null;
    console.log(`  2nd call: ${secondMs}ms total, ${secondGraphqlMs}ms graphql (${secondCacheHits} cache hits)`);
    if (expectSfdxHardisBadge) assertSfdxHardisBadge(second, username, '2nd call');

    const warnings = second.warnings || [];

    // Save the second (cached) banner image
    if (typeof second.imageUrl !== 'string' || !second.imageUrl.startsWith('data:image/')) {
      throw new Error(`Unexpected imageUrl format: ${String(second.imageUrl).slice(0, 80)}`);
    }
    const base64 = second.imageUrl.replace(/^data:image\/[^;]+;base64,/, '');
    const pngBuffer = Buffer.from(base64, 'base64');
    const file = `${username}.png`;
    writeFileSync(join(outputDir, file), pngBuffer);

    console.log(`  OK → ${file}`);
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
      file,
    });
  } catch (err) {
    console.log(`  EXCEPTION: ${err.message}`);
    results.push({ username, status: null, error: err.message });
    if (expectSfdxHardisBadge) requiredCaseFailed = true;
  }

  // Small delay to avoid Trailhead rate limiting
  await new Promise((r) => setTimeout(r, 1000));
}

const resultsPath = join(outputDir, 'results.json');
writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(`Results written to ${resultsPath}`);

if (requiredCaseFailed) {
  console.error('ERROR: A required banner-preview integration case failed');
  process.exitCode = 1;
}
