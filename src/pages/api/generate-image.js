import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_TRAILHEAD_BADGES from '../../graphql/queries/getTrailheadBadges';
import GET_MVP_STATUS from '../../graphql/queries/getMvpStatus';
import { generateImage } from '../../utils/generateImage';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const options = req.body;

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
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const url = `${protocol}://${host}/api/graphql-query`;

      // Perform the GraphQL queries in parallel
      const [rankResponse, certificationsResponse, badgesResponse, superbadgesResponse, mvpResponse] =
        await Promise.all(
          graphqlQueries.map((graphqlQuery) =>
            axios.post(url, graphqlQuery, {
              headers: {
                'Content-Type': 'application/json',
              },
            })
          )
        );

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

      // Send back the combined data and image URL
      res.status(200).json({ rankData, certificationsData, badgesData, superbadgesData, mvpData, imageUrl, warnings });
    } catch (error) {
      console.error('Error fetching data:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
