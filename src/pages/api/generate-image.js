import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_TRAILHEAD_BADGES from '../../graphql/queries/getTrailheadBadges';
import GET_MVP_STATUS from '../../graphql/queries/getMvpStatus';
import GET_STAMPS from '../../graphql/queries/getStamps';
import { generateImage } from '../../utils/generateImage';
import SupabaseUtils from '../../utils/supabaseUtils';
import GraphQLUtils from '../../utils/graphqlUtils';
import { getMaintenanceInfoMessages } from '../../utils/certificationMaintenanceUtils';
import { validateUsernameWithGraphQL } from '../../utils/usernameValidation';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // Set limit to 5MB
    },
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Check content length against limit (5MB)
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 5 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Request entity too large. Maximum payload size is 5MB',
      });
    }

    const start_time = new Date().getTime();
    const timings = {}; // Track detailed timings
    const options = req.body;
    // const protocol = req.headers['x-forwarded-proto'] || 'http';
    // const host = req.headers.host;

    // Validate username only if it differs from lastValidatedUsername
    const shouldValidateUsername = !options.lastValidatedUsername || options.lastValidatedUsername !== options.username;
    if (shouldValidateUsername) {
      const validationStart = new Date().getTime();

      // Use shared validation logic from utils
      const validationResult = await validateUsernameWithGraphQL(options.username, axios, GET_TRAILBLAZER_RANK);

      timings.username_validation_ms = new Date().getTime() - validationStart;

      if (!validationResult.valid) {
        return res.status(400).json({
          error: validationResult.message,
          validationError: true,
        });
      }
    } else {
      timings.username_validation_ms = 0; // Validation was skipped (cached)
      console.log(`[Banner] Skipping username validation for '${options.username}' (matches lastValidatedUsername)`);
    }

    const graphqlQueries = [
      {
        query: GET_TRAILBLAZER_RANK,
        variables: {
          slug: options.username,
          hasSlug: true,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_USER_CERTIFICATIONS,
        variables: {
          slug: options.username,
          hasSlug: true,
          count: 100,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_TRAILHEAD_BADGES,
        variables: {
          slug: options.username,
          hasSlug: true,
          count: 5,
          after: null,
          filter: null,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_TRAILHEAD_BADGES,
        variables: {
          slug: options.username,
          hasSlug: true,
          count: 100,
          after: null,
          filter: 'SUPERBADGE',
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_MVP_STATUS,
        variables: {
          userSlug: options.username,
          queryMvp: true,
        },
        url: 'https://community.api.trailhead.com/graphql',
      },
      {
        query: GET_STAMPS,
        variables: {
          slug: options.username,
          first: 10,
        },
        url: 'https://mobile.api.trailhead.com/graphql',
      },
    ];

    try {
      // Perform the GraphQL queries in parallel using the utils class with caching
      const graphqlStart = new Date().getTime();
      const { responses, timingBreakdown, cacheSummary } = await GraphQLUtils.performQueriesWithCache(
        graphqlQueries,
        options.username
      );
      const [rankResponse, certificationsResponse, badgesResponse, superbadgesResponse, mvpResponse, stampsResponse] =
        responses;
      timings.graphql_queries_ms = new Date().getTime() - graphqlStart;
      timings.graphql_breakdown = timingBreakdown;
      timings.cache_summary = cacheSummary;

      // Extract the data from the responses
      const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
      const certificationsData = certificationsResponse.data?.data?.profile?.credential || {};
      const badgesData = badgesResponse.data?.data?.profile || {};
      const superbadgesData = superbadgesResponse.data?.data?.profile || {};
      const mvpData = mvpResponse.data?.data?.profileData || {};
      const stampsData = stampsResponse.data?.data?.earnedStamps || {};

      // Generate the image
      const imageGenStart = new Date().getTime();
      const generateImageResult = await generateImage({
        ...options,
        rankData,
        certificationsData,
        badgesData,
        superbadgesData,
        mvpData,
        stampsData,
      });
      timings.image_generation_ms = new Date().getTime() - imageGenStart;

      const imageUrl = generateImageResult.bannerUrl;
      const warnings = generateImageResult.warnings || [];
      const imageHash = generateImageResult.hash;

      // Merge timings from generateImage if available
      if (generateImageResult.timings) {
        timings.image_generation_breakdown = generateImageResult.timings;
      }

      // Collect all info messages
      const infoMessages = [...getMaintenanceInfoMessages(certificationsData.certifications)];
      // Future: Add other info message types here

      // Calculate total time and add to timings
      timings.total_ms = new Date().getTime() - start_time;
      timings.other_ms = timings.total_ms - timings.graphql_queries_ms - timings.image_generation_ms;

      // Log detailed timing breakdown
      console.log('[Banner] Full Timings:', JSON.stringify(timings, null, 2));

      // Log timings for debugging
      console.log(
        `[Banner] Total: ${timings.total_ms}ms | GraphQL: ${timings.graphql_queries_ms}ms (${cacheSummary.cache_hits}/${cacheSummary.total_queries} cached) | Image: ${timings.image_generation_ms}ms | Other: ${timings.other_ms}ms`
      );

      // Update the counter in the database (non-blocking)
      const thb_data = {
        th_username: options.username,
        thb_processing_time: timings.total_ms,
        options,
        bannerHash: imageHash,
        certificationsData: certificationsData,
        badgesData: badgesData,
        superbadgesData: superbadgesData,
        rankData: rankData,
        mvpData: mvpData,
        stampsData: stampsData,
        timings: timings,
      };
      SupabaseUtils.updateBannerCounter(thb_data).catch((error) => {
        console.error('Error updating banner counter:', error.message);
      });

      // Send back the combined data and image URL
      res.status(200).json({
        rankData,
        certificationsData,
        badgesData,
        superbadgesData,
        mvpData,
        stampsData,
        imageUrl,
        warnings,
        infoMessages,
        timings,
      });
    } catch (error) {
      console.error('Error generating banner:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        res.status(500).json({
          error: `Failed to fetch data or generate image. Response status: ${error.response.status}. Response data: ${error.response.data}`,
        });
      } else if (error.request) {
        console.error('Request data:', error.request);
        res
          .status(500)
          .json({ error: 'Failed to fetch data or generate image. No response received from the server.' });
      } else {
        console.error('Error message:', error.message);
        res.status(500).json({ error: `Failed to fetch data or generate image. Error message: ${error.message}` });
      }
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
