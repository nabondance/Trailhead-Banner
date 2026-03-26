import crypto from 'crypto';
import { generateCompanyBanner } from '../../../banner/renderers/companyBanner';
import { fetchCompanyData, parseUsernames } from '../../../utils/companyFetchUtils';
import { aggregateCompanyData } from '../../../utils/companyDataUtils';
import { generateCompanyCsv } from '../../../utils/companyCsvUtils';
import SupabaseUtils from '../../../utils/supabaseUtils';
import { validateContentLength } from '../../../banner/api/validators';
import { createTimingTracker, handleBannerError } from '../../../banner/api/shared';
import '../../../utils/fonts.js'; // Register fonts with @napi-rs/canvas

function buildTeamHash(usernames) {
  const sorted = [...usernames].sort().join(',');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 12);
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

  try {
    // Validate usernames input
    const usernames = Array.isArray(rawUsernames)
      ? rawUsernames
      : parseUsernames(typeof rawUsernames === 'string' ? rawUsernames : '');

    if (!usernames || usernames.length === 0) {
      return res.status(400).json({
        error: 'At least one username is required',
        validationError: true,
      });
    }

    // Build a stable team identifier from sorted usernames
    const teamHash = buildTeamHash(usernames);

    // Fetch data for all usernames in parallel
    timings.start('fetch');
    console.log(`[Company Banner] Fetching data for ${usernames.length} usernames`);
    const { resolved, failed } = await fetchCompanyData(usernames);
    timings.end('fetch');

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

    // Generate CSV if requested
    let csvData = null;
    if (options.generateCsv) {
      timings.start('csv_generation');
      csvData = generateCompanyCsv(aggregated, failed);
      timings.end('csv_generation');
    }

    const allTimings = timings.getAll();
    allTimings.total_ms = Date.now() - startTime;

    console.log(
      `[Company Banner] Total: ${allTimings.total_ms}ms | Fetch: ${allTimings.fetch_ms}ms | Agg: ${allTimings.aggregation_ms}ms | Image: ${allTimings.image_generation_ms}ms`
    );

    // Analytics (non-blocking)
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
      mvp_count: aggregated.counters.mvp,
      ranger_count: aggregated.counters.ranger,
      cta_count: aggregated.counters.cta,
      agentblazer: aggregated.agentblazer,
      options,
      csv_requested: !!options.generateCsv,
      timings: allTimings,
    }).catch((error) => {
      console.error('Error updating company banner counter:', error.message);
    });

    return res.status(200).json({
      imageUrl: result.bannerUrl,
      csvData,
      teamHash,
      warnings: result.warnings || [],
      failedUsers: failed,
      timings: allTimings,
    });
  } catch (error) {
    return handleBannerError(error, res, 'company banner', {});
  }
}
