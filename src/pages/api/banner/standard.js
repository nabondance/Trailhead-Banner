import { generateStandardBanner } from '../../../banner/renderers/standardBanner';
import SupabaseUtils from '../../../utils/supabaseUtils';
import { getMaintenanceInfoMessages } from '../../../utils/certificationMaintenanceUtils';
import { validateUsername, validateContentLength } from '../../../banner/api/validators';
import { buildStandardQueries } from '../../../banner/api/queryBuilder';
import { fetchUserData, createTimingTracker, handleBannerError } from '../../../banner/api/shared';
import '../../../utils/fonts.js'; // Register fonts with @napi-rs/canvas

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate content length
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const contentValidation = validateContentLength(contentLength);
  if (!contentValidation.valid) {
    return res.status(413).json({ error: contentValidation.error });
  }

  const startTime = Date.now();
  const timings = createTimingTracker();
  const options = req.body;

  try {
    // Username validation (with caching optimization)
    const shouldValidate = !options.lastValidatedUsername || options.lastValidatedUsername !== options.username;

    if (shouldValidate) {
      timings.start('username_validation');
      const validation = await validateUsername(options.username);
      timings.end('username_validation');

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.message,
          validationError: true,
        });
      }
    } else {
      timings.add('username_validation_ms', 0);
      console.log(`[Banner] Skipping username validation for '${options.username}' (matches lastValidatedUsername)`);
    }

    // Build and fetch GraphQL queries
    const queries = buildStandardQueries(options.username, options);
    console.log(`[Banner] Required queries (${queries.length}):`, queries.map((q) => q.name).join(', '));

    const { responseMap, cacheSummary, timingBreakdown, totalTime } = await fetchUserData(queries, options.username);
    timings.add('graphql_queries_ms', totalTime);
    timings.add('graphql_breakdown', timingBreakdown);
    timings.add('cache_summary', cacheSummary);

    // Extract data from GraphQL responses (with fallbacks for queries that weren't executed)
    const rankData = responseMap.GET_TRAILBLAZER_RANK?.data?.data?.profile?.trailheadStats || {};
    const certificationsData = responseMap.GET_USER_CERTIFICATIONS?.data?.data?.profile?.credential || {};
    const badgesData = responseMap.GET_TRAILHEAD_BADGES?.data?.data?.profile || {};
    const superbadgesData = responseMap.GET_TRAILHEAD_BADGES_SUPERBADGE?.data?.data?.profile || {};
    const mvpData = responseMap.GET_MVP_STATUS?.data?.data?.profileData || {};
    const stampsData = responseMap.GET_STAMPS?.data?.data?.earnedStamps || {};
    const agentblazerData = responseMap.GET_AGENTBLAZER_RANK?.data?.data?.profile?.trailheadStats || {};

    // Generate banner (call renderer directly)
    timings.start('image_generation');
    const result = await generateStandardBanner(
      {
        rankData,
        certificationsData,
        badgesData,
        superbadgesData,
        mvpData,
        stampsData,
        agentblazerData,
      },
      options
    );
    timings.end('image_generation');
    timings.add('image_generation_breakdown', result.timings);

    const imageUrl = result.bannerUrl;
    const warnings = result.warnings || [];
    const imageHash = result.hash;

    // Collect info messages
    const infoMessages = getMaintenanceInfoMessages(certificationsData.certifications || []);

    // Calculate total timing
    const allTimings = timings.getAll();
    allTimings.total_ms = Date.now() - startTime;
    allTimings.other_ms =
      allTimings.total_ms -
      (allTimings.username_validation_ms || 0) -
      allTimings.graphql_queries_ms -
      allTimings.image_generation_ms;

    // Log timing breakdown
    console.log('[Banner] Full Timings:', JSON.stringify(allTimings, null, 2));
    console.log(
      `[Banner] Total: ${allTimings.total_ms}ms | GraphQL: ${allTimings.graphql_queries_ms}ms (${cacheSummary.cache_hits}/${cacheSummary.total_queries} cached) | Image: ${allTimings.image_generation_ms}ms | Other: ${allTimings.other_ms}ms`
    );

    // Update Supabase counter (non-blocking)
    const thb_data = {
      th_username: options.username,
      thb_processing_time: allTimings.total_ms,
      options,
      bannerHash: imageHash,
      certificationsData,
      badgesData,
      superbadgesData,
      rankData,
      mvpData,
      stampsData,
      agentblazerData,
      timings: allTimings,
    };
    SupabaseUtils.updateBannerCounter(thb_data).catch((error) => {
      console.error('Error updating banner counter:', error.message);
    });

    // Send response
    return res.status(200).json({
      rankData,
      certificationsData,
      badgesData,
      superbadgesData,
      mvpData,
      stampsData,
      agentblazerData,
      imageUrl,
      warnings,
      infoMessages,
      timings: allTimings,
    });
  } catch (error) {
    return handleBannerError(error, res, 'standard banner', { username: options.username });
  }
}
