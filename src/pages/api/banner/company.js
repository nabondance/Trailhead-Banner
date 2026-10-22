import crypto from 'crypto';
import { generateCompanyBanner } from '../../../banner/renderers/companyBanner';
import {
  fetchCompanyData,
  parseUsernameInput,
  computeQueryNeeds,
  FETCH_CHUNK_SIZE,
  MAX_COMPANY_USERS,
  MAX_DIRECT_USERS,
} from '../../../utils/companyFetchUtils';
import { isValidChunkToken, loadCompanyChunks } from '../../../utils/companyChunkStore';
import { aggregateCompanyData } from '../../../utils/companyDataUtils';
import { generateCompanyCsv, generateProductCsv, generateMaintenanceCsv } from '../../../utils/companyCsvUtils';
import { getTeamMaintenanceSummary } from '../../../utils/certificationMaintenanceUtils';
import { waitUntil } from '@vercel/functions';
import SupabaseUtils from '../../../utils/supabaseUtils';
import { validateContentLength } from '../../../banner/api/validators';
import { createTimingTracker, handleBannerError } from '../../../banner/api/shared';
import { enforceRateLimit } from '../../../utils/rateLimit';
import '../../../utils/fonts.js'; // Register fonts with @napi-rs/canvas

function buildTeamHash(usernames) {
  const sorted = [...usernames].sort().join(',');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 12);
}

/**
 * Options copy safe for analytics logging: uploaded images arrive as base64
 * data-URLs (multi-MB) and must not be written to Supabase.
 */
function sanitizeOptionsForLogging(options) {
  const sanitized = { ...options };
  for (const key of ['backgroundImageUrl', 'customBackgroundImageUrl', 'companyLogoUrl']) {
    if (typeof sanitized[key] === 'string' && sanitized[key].startsWith('data:')) {
      sanitized[key] = '[uploaded-image]';
    }
  }
  // Duplicate of counterOrder as full config objects — ids are enough
  delete sanitized.selectedCounters;
  return sanitized;
}

// Retries add chunks (up to 3 attempts per user, and the last retry chunks
// can be small), so allow well over a full team's worth. Tokens are tiny.
const MAX_CHUNK_TOKENS = Math.ceil(MAX_COMPANY_USERS / FETCH_CHUNK_SIZE) * 10;
const FAILED_STATUSES = new Set(['not_found', 'private', 'rate_limited', 'timeout', 'error']);

/**
 * Merge stored fetch chunks into one resolved/failed list. A user can appear in
 * several chunks (retries) and under different casing: a successful fetch
 * wins over a failure, and the latest failure status wins otherwise.
 *
 * @param {Array} chunks - Chunks from loadCompanyChunks
 * @param {Array} clientFailed - Users the client gave up on (no chunk reports them)
 * @returns {{resolved: Array, failed: Array}}
 */
function mergeChunks(chunks, clientFailed) {
  const resolvedByKey = new Map();
  const failedByKey = new Map();
  for (const chunk of chunks) {
    for (const user of chunk.resolved || []) {
      const key = user.username.toLowerCase();
      if (!resolvedByKey.has(key)) resolvedByKey.set(key, user);
    }
    for (const failure of chunk.failed || []) {
      failedByKey.set(failure.username.toLowerCase(), failure);
    }
  }
  for (const failure of clientFailed) {
    const key = failure.username.toLowerCase();
    if (!failedByKey.has(key)) failedByKey.set(key, failure);
  }
  const failed = [...failedByKey].filter(([key]) => !resolvedByKey.has(key)).map(([, failure]) => failure);
  return { resolved: [...resolvedByKey.values()], failed };
}

/**
 * Client-reported failures are display/analytics only: keep a clean username
 * and a known status, nothing else.
 */
function sanitizeClientFailed(list) {
  if (!Array.isArray(list)) return [];
  const usernames = parseUsernameInput(list.map((f) => f?.username));
  const statusByName = new Map(
    list.filter((f) => typeof f?.username === 'string').map((f) => [f.username.trim(), f.status])
  );
  return usernames.slice(0, MAX_COMPANY_USERS).map((username) => {
    const status = statusByName.get(username);
    return { username, status: FAILED_STATUSES.has(status) ? status : 'error' };
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Higher limit for company logo base64
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, 'company'))) return;

  const contentLength = parseInt(req.headers['content-length'] || '0');
  const contentValidation = validateContentLength(contentLength, 10 * 1024 * 1024);
  if (!contentValidation.valid) {
    return res.status(413).json({ error: contentValidation.error });
  }

  const startTime = Date.now();
  const timings = createTimingTracker();
  const body = req.body || {};
  const options = body.options || {};
  // Tokens from the chunked /api/banner/company-fetch flow (data kept server-side)
  const isChunked = Array.isArray(body.chunkTokens);

  try {
    let usernames;
    let resolved;
    let failed;

    if (isChunked) {
      const tokens = [...new Set(body.chunkTokens)];
      if (tokens.length > MAX_CHUNK_TOKENS || !tokens.every(isValidChunkToken)) {
        return res.status(400).json({ error: 'Invalid fetch session. Please generate again.', validationError: true });
      }
      const { chunks, missing } = await loadCompanyChunks(tokens);
      if (missing > 0) {
        return res.status(410).json({
          error: 'The fetched Trailhead data has expired. Please generate the banner again.',
          validationError: true,
        });
      }
      ({ resolved, failed } = mergeChunks(chunks, sanitizeClientFailed(body.failedUsers)));
      usernames = [...resolved.map((u) => u.username), ...failed.map((f) => f.username)];
      if (usernames.length > MAX_COMPANY_USERS) {
        return res.status(400).json({
          error: `A company banner supports up to ${MAX_COMPANY_USERS} Trailblazers.`,
          validationError: true,
        });
      }
      // The fetch time was spent in /api/banner/company-fetch invocations, so
      // the client reports its fetch wall-time for accurate processing_time
      // analytics (clamped to 30min to keep garbage values out of the stats).
      const clientFetchMs = Math.min(Math.max(0, Math.round(Number(body.clientFetchMs) || 0)), 30 * 60 * 1000);
      timings.add('fetch_ms', clientFetchMs);
    } else {
      // Direct flow: fetch everything server-side (throttled)
      usernames = parseUsernameInput(body.usernames);

      if (usernames.length === 0) {
        return res.status(400).json({
          error: 'At least one username is required',
          validationError: true,
        });
      }
      if (usernames.length > MAX_DIRECT_USERS) {
        return res.status(400).json({
          error: `Maximum ${MAX_DIRECT_USERS} usernames per request; use /api/banner/company-fetch for larger teams`,
          validationError: true,
        });
      }

      // Same per-username Trailhead budget as the chunked flow
      if (!(await enforceRateLimit(req, res, 'companyFetchUsers', usernames.length))) return;

      timings.start('fetch');
      console.log(`[Company Banner] Fetching data for ${usernames.length} usernames`);
      ({ resolved, failed } = await fetchCompanyData(usernames, { queryOptions: options }));
      timings.end('fetch');
    }

    if (usernames.length === 0) {
      return res.status(400).json({
        error: 'At least one username is required',
        validationError: true,
      });
    }

    // Build a stable team identifier from sorted usernames
    const teamHash = buildTeamHash(usernames);

    console.log(`[Company Banner] Resolved: ${resolved.length}, Failed: ${failed.length}`);

    if (resolved.length === 0) {
      return res.status(400).json({
        error: 'None of the provided usernames could be resolved. Check usernames and try again.',
        failedUsers: failed,
        validationError: true,
      });
    }

    // Aggregate data
    timings.start('aggregation');
    const aggregated = aggregateCompanyData(resolved, options);
    timings.end('aggregation');

    // Generate banner
    timings.start('image_generation');
    const result = await generateCompanyBanner(aggregated, options);
    timings.end('image_generation');
    timings.add('image_generation_breakdown', result.timings);

    // Per-person maintenance notice — always computed (independent of CSV export),
    // shown as an info block on the result. Null when nothing is due.
    const maintenanceInfo = getTeamMaintenanceSummary(aggregated.perUserData);

    // Generate CSVs if requested
    let csvData = null;
    let productCsvData = null;
    let maintenanceCsvData = null;
    if (options.generateCsv) {
      timings.start('csv_generation');
      csvData = generateCompanyCsv(aggregated, failed);
      productCsvData = generateProductCsv(aggregated);
      // null when no teammate has a certification due for maintenance
      maintenanceCsvData = generateMaintenanceCsv(aggregated);
      timings.end('csv_generation');
    }

    const allTimings = timings.getAll();
    // For the chunked flow the fetch happened client-side, so include its
    // reported duration in the total processing time
    allTimings.total_ms = Date.now() - startTime + (isChunked ? allTimings.fetch_ms : 0);

    console.log(
      `[Company Banner] Total: ${allTimings.total_ms}ms | Fetch: ${allTimings.fetch_ms}ms | Agg: ${allTimings.aggregation_ms}ms | Image: ${allTimings.image_generation_ms}ms`
    );

    // Analytics (non-blocking). waitUntil keeps the function alive after the
    // response so the insert can finish. mvp_count is null when the MVP query was
    // skipped (see computeQueryNeeds) — 0 would mean "no MVPs", not "unknown".
    const queryNeeds = computeQueryNeeds(options);
    const mvpFetched = queryNeeds.mvp;
    const company_data = {
      team_hash: teamHash,
      processing_time: allTimings.total_ms,
      team_size: usernames.length,
      resolved_count: resolved.length,
      failed_count: failed.length,
      failed_users: failed,
      cert_count: aggregated.counters.certification,
      active_cert_count: aggregated.counters['active-certs'],
      badge_count: aggregated.counters.badge,
      sb_count: aggregated.counters.superbadge,
      mvp_count: mvpFetched ? aggregated.counters.mvp : null,
      ranger_count: aggregated.counters.ranger,
      cta_count: aggregated.counters.cta,
      agentblazer: aggregated.agentblazer,
      // null when the badges were not fetched (display off, no CSV)
      sfdx_hardis: queryNeeds.sfdxHardis ? aggregated.sfdxHardis : null,
      options: sanitizeOptionsForLogging(options),
      csv_requested: !!options.generateCsv,
      timings: allTimings,
    };
    waitUntil(
      SupabaseUtils.updateCompanyBannerCounter(company_data).catch((error) => {
        console.error('Error updating company banner counter:', error.message);
      })
    );

    return res.status(200).json({
      imageUrl: result.bannerUrl,
      csvData,
      productCsvData,
      maintenanceCsvData,
      maintenanceInfo,
      teamHash,
      warnings: result.warnings || [],
      failedUsers: failed,
      timings: allTimings,
    });
  } catch (error) {
    return handleBannerError(error, res, 'company banner', {});
  }
}
