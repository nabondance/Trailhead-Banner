import { fetchUserData } from '../banner/api/shared.js';
import { QUERY_MAP } from '../banner/api/queryBuilder.js';

/**
 * Fixed query set for company banner (per username).
 * Fetches rank, certifications, superbadges, MVP, and agentblazer data.
 * Does not fetch stamps or community stats (not needed for company banner).
 *
 * @param {string} username - Trailhead username
 * @returns {Array} Array of GraphQL query configurations
 */
function buildCompanyQueries(username) {
  return [
    {
      name: 'GET_TRAILBLAZER_RANK',
      query: QUERY_MAP.GET_TRAILBLAZER_RANK.query,
      variables: QUERY_MAP.GET_TRAILBLAZER_RANK.buildVariables(username, {}),
      url: QUERY_MAP.GET_TRAILBLAZER_RANK.url,
    },
    {
      name: 'GET_USER_CERTIFICATIONS',
      query: QUERY_MAP.GET_USER_CERTIFICATIONS.query,
      variables: QUERY_MAP.GET_USER_CERTIFICATIONS.buildVariables(username, { count: 100 }),
      url: QUERY_MAP.GET_USER_CERTIFICATIONS.url,
    },
    {
      name: 'GET_TRAILHEAD_BADGES_SUPERBADGE',
      query: QUERY_MAP.GET_TRAILHEAD_BADGES_SUPERBADGE.query,
      variables: QUERY_MAP.GET_TRAILHEAD_BADGES_SUPERBADGE.buildVariables(username, { count: 100 }),
      url: QUERY_MAP.GET_TRAILHEAD_BADGES_SUPERBADGE.url,
    },
    {
      name: 'GET_MVP_STATUS',
      query: QUERY_MAP.GET_MVP_STATUS.query,
      variables: QUERY_MAP.GET_MVP_STATUS.buildVariables(username, {}),
      url: QUERY_MAP.GET_MVP_STATUS.url,
    },
    {
      name: 'GET_AGENTBLAZER_RANK',
      query: QUERY_MAP.GET_AGENTBLAZER_RANK.query,
      variables: QUERY_MAP.GET_AGENTBLAZER_RANK.buildVariables(username, {}),
      url: QUERY_MAP.GET_AGENTBLAZER_RANK.url,
    },
  ];
}

/**
 * Fetch data for a single username, returning structured data or a failure result.
 *
 * @param {string} username
 * @returns {Promise<{success: boolean, username: string, data?: Object, status?: string, error?: string}>}
 */
async function fetchSingleUser(username) {
  const queries = buildCompanyQueries(username);

  try {
    const { responseMap } = await fetchUserData(queries, username);

    const rankData = responseMap.GET_TRAILBLAZER_RANK?.data?.data?.profile?.trailheadStats || {};
    const certificationsData = responseMap.GET_USER_CERTIFICATIONS?.data?.data?.profile?.credential || {};
    const superbadgesData = responseMap.GET_TRAILHEAD_BADGES_SUPERBADGE?.data?.data?.profile || {};
    const mvpData = responseMap.GET_MVP_STATUS?.data?.data?.profileData || {};
    const agentblazerData = responseMap.GET_AGENTBLAZER_RANK?.data?.data?.profile?.trailheadStats || {};

    // Detect private profile
    const profileType = responseMap.GET_TRAILBLAZER_RANK?.data?.data?.profile?.__typename;
    if (profileType === 'PrivateProfile') {
      return { success: false, username, status: 'private' };
    }

    // Detect not found (no rank data at all)
    if (!rankData || Object.keys(rankData).length === 0) {
      return { success: false, username, status: 'not_found' };
    }

    return {
      success: true,
      username,
      data: {
        username,
        rankData,
        certificationsData,
        superbadgesData,
        mvpData,
        agentblazerData,
      },
    };
  } catch (error) {
    console.error(`Error fetching data for username ${username}:`, error.message);
    const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
    return {
      success: false,
      username,
      status: isTimeout ? 'timeout' : 'not_found',
      error: error.message,
    };
  }
}

/**
 * Parse and deduplicate a username list from a textarea string.
 * Supports newline and comma separators.
 *
 * @param {string} raw - Raw textarea content
 * @returns {string[]} Cleaned, unique usernames
 */
export function parseUsernames(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return [
    ...new Set(
      raw
        .split(/[\n, ]+/)
        .map((u) => u.trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * Fetch Trailhead data for multiple usernames in parallel.
 *
 * @param {string[]} usernames - Array of Trailhead usernames
 * @returns {Promise<{resolved: Array, failed: Array}>}
 */
export async function fetchCompanyData(usernames) {
  if (!usernames || usernames.length === 0) {
    return { resolved: [], failed: [] };
  }

  const results = await Promise.allSettled(usernames.map((username) => fetchSingleUser(username)));

  const resolved = [];
  const failed = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      // Promise itself rejected (unexpected)
      failed.push({ username: 'unknown', status: 'error', error: result.reason?.message });
      continue;
    }

    const value = result.value;
    if (value.success) {
      resolved.push(value.data);
    } else {
      failed.push({ username: value.username, status: value.status || 'not_found' });
    }
  }

  return { resolved, failed };
}
