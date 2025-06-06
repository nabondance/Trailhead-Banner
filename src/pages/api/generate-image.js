import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_TRAILHEAD_BADGES from '../../graphql/queries/getTrailheadBadges';
import GET_MVP_STATUS from '../../graphql/queries/getMvpStatus';
import { generateImage } from '../../utils/generateImage';
import SupabaseUtils from '../../utils/supabaseUtils';
import GraphQLUtils from '../../utils/graphqlUtils';

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
    const options = req.body;
    // const protocol = req.headers['x-forwarded-proto'] || 'http';
    // const host = req.headers.host;

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
    ];

    try {
      // Perform the GraphQL queries in parallel using the utils class
      const [rankResponse, certificationsResponse, badgesResponse, superbadgesResponse, mvpResponse] =
        await GraphQLUtils.performQueries(graphqlQueries);

      // Extract the data from the responses
      const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
      const certificationsData = certificationsResponse.data?.data?.profile?.credential || {};
      const badgesData = badgesResponse.data?.data?.profile || {};
      const superbadgesData = superbadgesResponse.data?.data?.profile || {};
      const mvpData = mvpResponse.data?.data?.profileData || {};

      // Generate the image
      const generateImageResult = await generateImage({
        ...options,
        rankData,
        certificationsData,
        badgesData,
        superbadgesData,
        mvpData,
      });
      const imageUrl = generateImageResult.bannerUrl;
      const warnings = generateImageResult.warnings;
      const imageHash = generateImageResult.hash;

      // Update the counter in the database
      try {
        const thb_data = {
          th_username: options.username,
          thb_processing_time: new Date().getTime() - start_time,
          options,
          bannerHash: imageHash,
          certificationsData: certificationsData,
          badgesData: badgesData,
          superbadgesData: superbadgesData,
          rankData: rankData,
          mvpData: mvpData,
        };
        SupabaseUtils.updateBannerCounter(thb_data);
      } catch (error) {
        console.error('Error updating banner counter:', error.message);
      }

      // Send back the combined data and image URL
      res.status(200).json({ rankData, certificationsData, badgesData, superbadgesData, mvpData, imageUrl, warnings });
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
