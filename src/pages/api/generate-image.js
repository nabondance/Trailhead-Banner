import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_TRAILHEAD_BADGES from '../../graphql/queries/getTrailheadBadges';
import GET_MVP_STATUS from '../../graphql/queries/getMvpStatus';
import { generateImage } from '../../utils/generateImage';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      username,
      backgroundColor,
      backgroundImageUrl,
      displaySuperbadges,
      textColor,
      includeExpiredCertifications,
      includeRetiredCertifications,
    } = req.body;

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
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_TRAILHEAD_BADGES,
        variables: {
          slug: username,
          hasSlug: true,
          count: 20,
          after: null,
          filter: null,
        },
        url: 'https://profile.api.trailhead.com/graphql',
      },
      {
        query: GET_TRAILHEAD_BADGES,
        variables: {
          slug: username,
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
          userSlug: username,
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
      const rankData = rankResponse.data.data.profile.trailheadStats;
      const certificationsData = certificationsResponse.data.data.profile.credential;
      const badgesData = badgesResponse.data.data.profile;
      const superbadgesData = superbadgesResponse.data.data.profile;
      const mvpData = mvpResponse.data.data.profileData;
      console.log('MVP Data:', mvpData);

      //   console.log('Rank Data:', rankData);
      //   console.log('Certifications Data:', certificationsData);
      //   console.log('Badges Data:', badgesData);

      // Generate the image
      const imageUrl = await generateImage(
        rankData,
        certificationsData,
        badgesData,
        superbadgesData,
        backgroundColor,
        backgroundImageUrl,
        displaySuperbadges,
        textColor,
        includeExpiredCertifications,
        includeRetiredCertifications,
        mvpData
      );

      // Send back the combined data and image URL
      res.status(200).json({ rankData, certificationsData, badgesData, superbadgesData, mvpData, imageUrl });
    } catch (error) {
      console.error('Error fetching data:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
