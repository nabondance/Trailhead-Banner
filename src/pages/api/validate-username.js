import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';

const endpoint = 'https://profile.api.trailhead.com/graphql';

export default async function handler(req, res) {
  const { username } = req.query;
  console.log('validating:', username);

  if (!username) {
    return res.status(400).json({ valid: false, state: 'invalid', message: 'Username is required' });
  }

  try {
    const response = await axios.post(
      endpoint,
      {
        query: GET_TRAILBLAZER_RANK,
        variables: { slug: username, hasSlug: true },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const responseData = response.data;

    if (responseData.errors) {
      return res.status(200).json({ valid: false, state: 'invalid', message: 'Trailhead profile does not exist' });
    }

    if (responseData.data.profile.__typename === 'PrivateProfile') {
      return res
        .status(200)
        .json({ valid: false, state: 'private', message: 'Trailhead profile is private, see How-To' });
    }

    return res.status(200).json({ valid: true, state: 'ok', message: 'Username is valid' });
  } catch (error) {
    console.error('Error validating username:', error);
    return res.status(500).json({ valid: false, state: 'invalid', message: 'Internal server error' });
  }
}
