import axios from 'axios';

const endpoint = 'https://profile.api.trailhead.com/graphql';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { query, variables } = req.body;

    try {
      // console.log('GraphQL query:', query);
      // console.log('GraphQL variables:', variables);

      const response = await axios.post(
        endpoint,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // console.log('GraphQL response:', response.data);

      res.status(200).json(response.data);
    } catch (error) {
      console.error('Error in GraphQL query:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
