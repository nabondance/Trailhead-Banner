import crypto from 'crypto';
import { generateCompanyBanner } from '../../../banner/renderers/companyBanner';
import { fetchCompanyData, parseUsernames, computeQueryNeeds } from '../../../utils/companyFetchUtils';
import { aggregateCompanyData } from '../../../utils/companyDataUtils';
import { generateCompanyCsv, generateProductCsv, generateMaintenanceCsv } from '../../../utils/companyCsvUtils';
import { getTeamMaintenanceSummary } from '../../../utils/certificationMaintenanceUtils';
import SupabaseUtils from '../../../utils/supabaseUtils';
import { validateContentLength } from '../../../banner/api/validators';
import { createTimingTracker, handleBannerError } from '../../../banner/api/shared';
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

  const contentLength = parseInt(req.headers['content-length'] || '0');
  const contentValidation = validateContentLength(contentLength, 10 * 1024 * 1024);
  if (!contentValidation.valid) {
    return res.status(413).json({ error: contentValidation.error });
  }

  const startTime = Date.now();
  const timings = createTimingTracker();
  const body = req.body || {};
  const options = body.options || {};
  const rawUsernames = body.usernames;
  // Pre-fetched data from the chunked /api/banner/company-fetch flow
  const preFetched = Array.isArray(body.resolvedData) ? body.resolvedData : null;

  try {
    let usernames;
    let resolved;
    let failed;

    if (preFetched) {
      // Chunked flow: the client already fetched user data chunk by chunk.
      // The fetch time was spent in /api/banner/company-fetch invocations, so
      // the client reports its fetch wall-time for accurate processing_time
      // analytics (clamped to 30min to keep garbage values out of the stats).
      const clientFetchMs = Math.min(Math.max(0, Math.round(Number(body.clientFetchMs) || 0)), 30 * 60 * 1000);
      resolved = preFetched.filter((u) => u && typeof u.username === 'string');
      failed = Array.isArray(body.failedUsers)
        ? body.failedUsers.filter((f) => f && typeof f.username === 'string')
        : [];
      usernames = [...resolved.map((u) => u.username), ...failed.map((f) => f.username)];
      timings.add('fetch_ms', clientFetchMs);
    } else {
      // Direct flow: fetch everything server-side (throttled)
      usernames = Array.isArray(rawUsernames)
        ? rawUsernames
        : parseUsernames(typeof rawUsernames === 'string' ? rawUsernames : '');

      if (usernames.length === 0) {
        return res.status(400).json({
          error: 'At least one username is required',
          validationError: true,
        });
      }

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
    allTimings.total_ms = Date.now() - startTime + (preFetched ? allTimings.fetch_ms : 0);

    console.log(
      `[Company Banner] Total: ${allTimings.total_ms}ms | Fetch: ${allTimings.fetch_ms}ms | Agg: ${allTimings.aggregation_ms}ms | Image: ${allTimings.image_generation_ms}ms`
    );

    // Analytics (non-blocking). mvp_count is null when the MVP query was
    // skipped (see computeQueryNeeds) — 0 would mean "no MVPs", not "unknown".
    const mvpFetched = computeQueryNeeds(options).mvp;
    SupabaseUtils.updateCompanyBannerCounter({
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
      options: sanitizeOptionsForLogging(options),
      csv_requested: !!options.generateCsv,
      timings: allTimings,
    }).catch((error) => {
      console.error('Error updating company banner counter:', error.message);
    });

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
