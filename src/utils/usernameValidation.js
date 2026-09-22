export const extractUsernameFromUrl = (input) => {
  const trimmedInput = input.trim();
  const urlMatch = trimmedInput.match(/https?:\/\/[^\s<>"']+/i);
  const urlCandidate = (urlMatch?.[0] || trimmedInput).replace(/[),;!?]+$/, '');

  try {
    const url = new URL(urlCandidate);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const isTrailblazerMeProfile = url.hostname === 'trailblazer.me' && pathParts[0]?.toLowerCase() === 'id';
    const isSalesforceProfile =
      (url.hostname === 'www.salesforce.com' || url.hostname === 'salesforce.com') &&
      pathParts[0]?.toLowerCase() === 'trailblazer';

    if ((isTrailblazerMeProfile || isSalesforceProfile) && pathParts.length === 2) {
      return decodeURIComponent(pathParts[1]);
    }
  } catch {
    // Plain usernames are expected input too, so an invalid URL is returned unchanged.
  }

  return urlCandidate;
};

export const validateUsernameFormat = (username) => {
  if (!username) {
    return { valid: false, state: 'invalid', message: 'Enter a username' };
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
