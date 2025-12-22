import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_STAMPS from '../../graphql/queries/getStamps';
import SupabaseUtils from '../../utils/supabaseUtils';
import GraphQLUtils from '../../utils/graphqlUtils';
import { generateRewind } from '../../utils/generateRewind';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const start_time = new Date().getTime();
    const { username, year = 2025 } = req.body;

    // Validate required parameters
    if (!username) {
      return res.status(400).json({
        error: 'Username is required',
      });
    }

    const graphqlQueries = [
      {
        query: GET_TRAILBLAZER_RANK,
        variables: {
          slug: username,
          hasSlug: true,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_USER_CERTIFICATIONS,
        variables: {
          slug: username,
          hasSlug: true,
          count: 100,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_STAMPS,
        variables: {
          slug: username,
          first: 50, // Increased to get more stamps for yearly analysis
        },
        url: 'https://mobile.api.trailhead.com/graphql',
      },
    ];

    try {
      // Perform the GraphQL queries in parallel using the utils class
      const [rankResponse, certificationsResponse, stampsResponse] = await GraphQLUtils.performQueries(graphqlQueries);

      // Extract the data from the responses
      const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
      const certificationsData = certificationsResponse.data?.data?.profile?.credential || {};
      const stampsData = stampsResponse.data?.data?.earnedStamps || {};

      // Generate the rewind image with all processing handled in the utility
      const generateRewindResult = await generateRewind({
        username,
        year,
        rankData,
        certificationsData,
        stampsData,
      });

      const imageUrl = generateRewindResult.imageUrl;
      const warnings = generateRewindResult.warnings || [];
      const rewindSummary = generateRewindResult.rewindSummary;
      const yearlyData = generateRewindResult.yearlyData;

      // Update the rewind counter in the database (non-blocking)
      const rewind_data = {
        th_username: username,
        rewind_processing_time: new Date().getTime() - start_time,
        year,
        rankData,
        yearlyData,
        rewindSummary,
      };
      SupabaseUtils.updateRewindCounter(rewind_data).catch((error) => {
        console.error('Error updating rewind counter:', error.message);
      });

      // Send back the rewind data and image URL
      res.status(200).json({
        imageUrl,
        warnings,
        rewindSummary,
        yearlyData,
        year,
        username,
      });
    } catch (error) {
      console.error('Error generating rewind:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        res.status(500).json({
          error: `Failed to fetch data for rewind. Response status: ${error.response.status}. Response data: ${error.response.data}`,
        });
      } else if (error.request) {
        console.error('Request data:', error.request);
        res.status(500).json({ error: 'Failed to fetch data for rewind. No response received from the server.' });
      } else {
        console.error('Error message:', error.message);
        res.status(500).json({ error: `Failed to fetch data for rewind. Error message: ${error.message}` });
      }
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
