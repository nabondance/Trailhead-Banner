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
    return { valid: false, state: 'invalid', message: "username shouldn't be an URL" };
  }

  if (username.includes('@')) {
    return { valid: false, state: 'invalid', message: "username shouldn't be an email address" };
  }

  if (username.includes(' ')) {
    return { valid: false, state: 'invalid', message: "username shouldn't contain spaces" };
  }

  return { valid: true, state: 'ok', message: 'Username format is valid' };
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
