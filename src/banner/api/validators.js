import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank.js';
import RedisCacheUtils from '../../utils/redisCacheUtils.js';

const VALIDATION_CACHE_TTL = 3600; // 1 hour
const TRAILHEAD_GRAPHQL_ENDPOINT = 'https://profile.api.trailhead.com/graphql';

/**
 * Validate username against the Trailhead GraphQL API, with Redis caching.
 * Cache key: validation:{username}, TTL: 1h (only on valid results).
 *
 * @param {string} username
 * @returns {Promise<{valid: boolean, state: string, message: string}>}
 */
export async function validateUsername(username) {
  if (!username) {
    return { valid: false, state: 'invalid', message: 'Username is required' };
  }

  const cacheKey = `validation:${username}`;
  const cached = await RedisCacheUtils.getCachedQuery(cacheKey);
  if (cached) {
    return cached;
  }

  console.log('Validating username via GraphQL:', username);

  let result;
  try {
    const response = await axios.post(
      TRAILHEAD_GRAPHQL_ENDPOINT,
      { query: GET_TRAILBLAZER_RANK, variables: { slug: username, hasSlug: true } },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const responseData = response.data;

    if (responseData.errors) {
      result = {
        valid: false,
        state: 'invalid',
        message: `Trailhead profile does not exist for username: ${username}`,
      };
    } else if (responseData.data.profile.__typename === 'PrivateProfile') {
      result = {
        valid: false,
        state: 'private',
        message: `Trailhead profile is private for username '${username}', see How-To`,
      };
    } else {
      result = { valid: true, state: 'ok', message: 'Username is valid' };
    }
  } catch (error) {
    console.error('Error validating username:', error);
    result = { valid: false, state: 'invalid', message: 'Internal server error' };
  }

  if (result.valid) {
    await RedisCacheUtils.setCachedQuery(cacheKey, result, VALIDATION_CACHE_TTL);
  }

  return result;
}

/**
 * Validate request content length.
 *
 * @param {number} contentLength - Content-Length header value in bytes
 * @param {number} maxBytes - Maximum allowed size (default: 5MB)
 * @returns {{valid: boolean, error?: string}}
 */
export function validateContentLength(contentLength, maxBytes = 5 * 1024 * 1024) {
  if (contentLength > maxBytes) {
    return { valid: false, error: 'Request entity too large. Maximum payload size is 5MB' };
  }
  return { valid: true };
}
