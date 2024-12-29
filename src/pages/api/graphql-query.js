import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { query, variables, url } = req.body;

    try {
      const response = await axios.post(
        url,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error('Error in GraphQL query:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
