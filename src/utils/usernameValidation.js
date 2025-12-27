export const extractUsernameFromUrl = (input) => {
  const trailblazerUrlPrefix = 'https://www.salesforce.com/trailblazer/';
  if (input.startsWith(trailblazerUrlPrefix)) {
    return input.substring(trailblazerUrlPrefix.length).split('?')[0].split('#')[0];
  }
  return input;
};

export const validateUsernameFormat = (username) => {
  if (!username) {
    return { valid: false, state: 'invalid', message: 'Enter an username' };
  }

  if (username.startsWith('http://') || username.startsWith('https://')) {
    return { valid: false, state: 'invalid', message: "Username shouldn't be an URL" };
  }

  if (username.includes('@')) {
    return { valid: false, state: 'invalid', message: "Username shouldn't be an email address" };
  }

  if (username.includes(' ')) {
    return { valid: false, state: 'invalid', message: "Username shouldn't contain spaces" };
  }

  return { valid: true, state: 'ok', message: 'Username format is valid' };
};

/**
 * Server-side username validation using GraphQL API
 * This function can be used by API routes to validate usernames
 */
export const validateUsernameWithGraphQL = async (username, axios, GET_TRAILBLAZER_RANK) => {
  console.log('Validating username via GraphQL:', username);
  if (!username) {
    return { valid: false, state: 'invalid', message: 'Username is required' };
  }

  const endpoint = 'https://profile.api.trailhead.com/graphql';

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
      return {
        valid: false,
        state: 'invalid',
        message: `Trailhead profile does not exist for username: ${username}`,
      };
    }

    if (responseData.data.profile.__typename === 'PrivateProfile') {
      return {
        valid: false,
        state: 'private',
        message: `Trailhead profile is private for username '${username}', see How-To`,
      };
    }

    return { valid: true, state: 'ok', message: 'Username is valid' };
  } catch (error) {
    console.error('Error validating username:', error);
    return { valid: false, state: 'invalid', message: 'Internal server error' };
  }
};

export const validateUsernameWithApi = async (username) => {
  try {
    const response = await fetch(`/api/validate-username?username=${username}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error validating username:', error);
    return {
      valid: false,
      state: 'invalid',
      message: 'Failed to validate username',
    };
  }
};
