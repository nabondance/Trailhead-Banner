import SupabaseUtils from '../../../utils/supabaseUtils';
import { generateRewind } from '../../../utils/generateRewind';
import { buildRewindQueries } from '../../../banner/api/queryBuilder';
import { fetchUserData, createTimingTracker, handleBannerError } from '../../../banner/api/shared';
import { validateUsername } from '../../../banner/api/validators';
import '../../../utils/fonts.js'; // Register fonts with @napi-rs/canvas

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Validate year parameter
 */
function validateYear(year) {
  if (year && (typeof year !== 'number' || year < 2020 || year > new Date().getFullYear() + 1)) {
    return { valid: false, error: 'Invalid year provided' };
  }
  return { valid: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported',
    });
  }

  const startTime = Date.now();
  const timings = createTimingTracker();
  const { username, year = 2025 } = req.body || {};

  // Validate username
  if (!username) {
    return res.status(400).json({
      error: 'Username is required',
      validationError: true,
    });
  }

  const usernameValidation = await validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({
      error: usernameValidation.message,
      validationError: true,
    });
  }

  // Validate year
  const yearValidation = validateYear(year);
  if (!yearValidation.valid) {
    return res.status(400).json({
      error: yearValidation.error,
      validationError: true,
    });
  }

  try {
    // Build and fetch GraphQL queries
    const queries = buildRewindQueries(username);
    const { responseMap, cacheSummary, timingBreakdown, totalTime } = await fetchUserData(queries, username);
    timings.add('graphql_queries_ms', totalTime);
    timings.add('graphql_breakdown', timingBreakdown);
    timings.add('cache_summary', cacheSummary);

    // Extract responses
    const rankResponse = responseMap.GET_TRAILBLAZER_RANK;
    const certificationsResponse = responseMap.GET_USER_CERTIFICATIONS;
    const stampsResponse = responseMap.GET_STAMPS;
    const agentblazerResponse = responseMap.GET_AGENTBLAZER_RANK;

    // Validate GraphQL responses
    if (!rankResponse?.data?.data?.profile) {
      return res.status(404).json({
        error: 'User not found',
        message: `No Trailhead profile found for username: ${username}`,
      });
    }

    // Extract the data from the responses with validation
    const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
    const certificationsData = certificationsResponse.data?.data?.profile?.credential || {};
    const stampsData = stampsResponse.data?.data?.earnedStamps || {};
    const agentblazerData = agentblazerResponse.data?.data?.profile?.trailheadStats || {};

    // Validate essential data is present
    if (!rankData.rank && !certificationsData.certifications && !stampsData.edges) {
      return res.status(422).json({
        error: 'Insufficient data',
        message: 'Unable to find sufficient Trailhead data to generate a rewind',
      });
    }

    // Generate the rewind image
    timings.start('image_generation');
    const generateRewindResult = await generateRewind({
      username,
      year,
      rankData,
      certificationsData,
      stampsData,
      agentblazerData,
    });
    timings.end('image_generation');
    timings.add('image_generation_breakdown', generateRewindResult.timings);

    // Validate rewind generation result
    if (!generateRewindResult?.imageUrl) {
      return res.status(500).json({
        error: 'Image generation failed',
        message: 'Failed to generate rewind image',
        warnings: generateRewindResult?.warnings || [],
      });
    }

    const imageUrl = generateRewindResult.imageUrl;
    const warnings = generateRewindResult.warnings || [];
    const rewindSummary = generateRewindResult.rewindSummary;
    const yearlyData = generateRewindResult.yearlyData;

    // Calculate total timing
    const allTimings = timings.getAll();
    allTimings.total_ms = Date.now() - startTime;
    allTimings.other_ms = allTimings.total_ms - allTimings.graphql_queries_ms - allTimings.image_generation_ms;

    // Log timing breakdown
    console.log('[Rewind] Full Timings:', JSON.stringify(allTimings, null, 2));
    console.log(
      `[Rewind] Total: ${allTimings.total_ms}ms | GraphQL: ${allTimings.graphql_queries_ms}ms (${cacheSummary.cache_hits}/${cacheSummary.total_queries} cached) | Image: ${allTimings.image_generation_ms}ms | Other: ${allTimings.other_ms}ms`
    );

    // Update the rewind counter in the database (non-blocking)
    const rewind_data = {
      th_username: username,
      rewind_processing_time: allTimings.total_ms,
      year,
      rankData,
      yearlyData,
      rewindSummary,
      timings: allTimings,
    };
    SupabaseUtils.updateRewindCounter(rewind_data).catch((error) => {
      console.error('Error updating rewind counter:', error.message);
    });

    // Send response
    return res.status(200).json({
      imageUrl,
      warnings,
      rewindSummary,
      yearlyData,
      year,
      username,
      timings: allTimings,
    });
  } catch (error) {
    return handleBannerError(error, res, 'rewind', { username: username ?? 'unknown', year: year ?? 'unknown' });
  }
}
