import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import { generateImage } from '../../utils/generateImage';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username } = req.body;

    const graphqlQueries = [
      {
        query: GET_TRAILBLAZER_RANK,
        variables: {
          slug: username,
          hasSlug: true,
        },
      },
      {
        query: GET_USER_CERTIFICATIONS,
        variables: {
          slug: username,
          hasSlug: true,
        },
      },
    ];

    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const url = `${protocol}://${host}/api/graphql-query`;

      // Perform the GraphQL queries in parallel
      const [rankResponse, certificationsResponse] = await Promise.all(
        graphqlQueries.map((graphqlQuery) =>
          axios.post(url, graphqlQuery, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
      );

      // Extract the data from the responses
      const rankData = rankResponse.data.data.profile.trailheadStats.rank;
      const certificationsData = certificationsResponse.data.data.profile.credential;

      console.log('Rank Data:', rankData);
      console.log('Certifications Data:', certificationsData);

      // Generate the image
      const imageUrl = generateImage(rankData, certificationsData);

      // Send back the combined data and image URL
      res.status(200).json({ rankData, certificationsData, imageUrl });
    } catch (error) {
      console.error('Error fetching data:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}