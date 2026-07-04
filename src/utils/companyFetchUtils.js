import { fetchUserData } from '../banner/api/shared.js';
import { QUERY_MAP } from '../banner/api/queryBuilder.js';

// Trailhead's APIs rate-limit per IP by request count (~200/min observed).
// With the combined profile query a user costs 1-2 requests, so 10 concurrent
// users stay comfortably under the limit.
const USER_CONCURRENCY = 10;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1500;

// Company banners are regenerated repeatedly while iterating on options, and a
// full fetch of a big team takes minutes — cache longer than the standard
// banner's 15min default.
const COMPANY_CACHE_TTL_SECONDS = 1800;

// Max usernames accepted per /api/banner/company-fetch call. The client chunks
// its list to this size; keep the two in sync via this export.
export const FETCH_CHUNK_SIZE = 25;

function isRateLimitError(error) {
  return (
    error?.response?.status === 429 ||
    error?.response?.data?.errors?.some((e) => e?.extensions?.code === 'TOO_MANY_REQUESTS')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shared rate-limit cooldown: when one worker gets a 429, every worker pauses
// instead of independently retrying into the same closed window. Trailhead's
// 429 responses carry no Retry-After header, so the backoff is our own.
// Module-level state is per warm serverless instance, which matches the
// per-instance request flow it protects.
let rateLimitCooldownUntil = 0;

function extendCooldown(attempt) {
  const delay = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
  rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, Date.now() + delay);
}

async function waitForCooldown() {
  let wait;
  while ((wait = rateLimitCooldownUntil - Date.now()) > 0) {
    await sleep(wait);
  }
}

/**
 * Determine which optional queries are needed for the requested output.
 * The combined profile query (rank + certs + superbadges + agentblazer) is
 * always fetched — it's a single request and one cache entry per user, so
 * option changes never force a refetch. Only MVP is a separate request (it
 * lives on the community API), needed for the mvp counter or the CSV export.
 *
 * @param {Object} options - Banner options (generateCsv, counterOrder)
 * @returns {{mvp: boolean}}
 */
export function computeQueryNeeds(options = {}) {
  const csv = !!options.generateCsv;
  const counters = Array.isArray(options.counterOrder) ? options.counterOrder : [];
  return {
    mvp: csv || counters.includes('mvp'),
  };
}

/**
 * Query set for company banner (per username): one combined profile-API
 * request, plus MVP from the community API when needed.
 *
 * @param {string} username - Trailhead username
 * @param {Object} needs - Output of computeQueryNeeds()
 * @returns {Array} Array of GraphQL query configurations
 */
function buildCompanyQueries(username, needs) {
  const queries = [
    {
      name: 'GET_COMPANY_PROFILE',
      query: QUERY_MAP.GET_COMPANY_PROFILE.query,
      variables: QUERY_MAP.GET_COMPANY_PROFILE.buildVariables(username, { count: 100 }),
      url: QUERY_MAP.GET_COMPANY_PROFILE.url,
    },
  ];
  if (needs.mvp) {
    queries.push({
      name: 'GET_MVP_STATUS',
      query: QUERY_MAP.GET_MVP_STATUS.query,
      variables: QUERY_MAP.GET_MVP_STATUS.buildVariables(username, {}),
      url: QUERY_MAP.GET_MVP_STATUS.url,
    });
  }
  return queries;
}

/**
 * Fetch data for a single username, returning structured data or a failure result.
 * Retries with exponential backoff when Trailhead rate-limits (HTTP 429);
 * the cooldown is shared across the worker pool, and successful queries are
 * Redis-cached, so retries only re-fetch what failed.
 *
 * @param {string} username
 * @param {Object} needs - Output of computeQueryNeeds()
 * @returns {Promise<{success: boolean, username: string, data?: Object, status?: string, error?: string}>}
 */
async function fetchSingleUser(username, needs) {
  const queries = buildCompanyQueries(username, needs);

  for (let attempt = 0; ; attempt++) {
    try {
      await waitForCooldown();
      return await fetchSingleUserOnce(queries, username);
    } catch (error) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_RETRIES) {
        extendCooldown(attempt);
        continue;
      }

      console.error(`Error fetching data for username ${username}:`, error.message);
      const isTimeout = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
      const status = isRateLimitError(error) ? 'rate_limited' : isTimeout ? 'timeout' : 'error';
      return { success: false, username, status, error: error.message };
    }
  }
}

async function fetchSingleUserOnce(queries, username) {
  const { responseMap } = await fetchUserData(queries, username, { ttlSeconds: COMPANY_CACHE_TTL_SECONDS });

  // Trailhead may rate-limit with a 200 + GraphQL error body; surface it as a
  // retryable rate-limit error instead of misreading the empty profile as not_found
  for (const response of Object.values(responseMap)) {
    if (response?.data?.errors?.some((e) => e?.extensions?.code === 'TOO_MANY_REQUESTS')) {
      const rateLimitError = new Error(`Rate limited while fetching data for ${username}`);
      rateLimitError.response = { status: 429 };
      throw rateLimitError;
    }
  }

  const profileBody = responseMap.GET_COMPANY_PROFILE?.data;

  // Nonexistent users come back as a 200 with a NOT_FOUND error body
  if (profileBody?.errors?.some((e) => e?.extensions?.code === 'NOT_FOUND')) {
    return { success: false, username, status: 'not_found' };
  }

  const profile = profileBody?.data?.profile;

  if (profile?.__typename === 'PrivateProfile') {
    return { success: false, username, status: 'private' };
  }

  const rankData = profile?.trailheadStats || {};
  if (Object.keys(rankData).length === 0) {
    return { success: false, username, status: 'not_found' };
  }

  return {
    success: true,
    username,
    data: {
      username,
      rankData,
      certificationsData: profile.credential || {},
      // aggregateCompanyData reads superbadgesData.earnedAwards.edges
      superbadgesData: profile,
      mvpData: responseMap.GET_MVP_STATUS?.data?.data?.profileData || {},
      // aggregateCompanyData reads agentblazerData.learnerStatusLevels
      agentblazerData: rankData,
    },
  };
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
 * Fetch Trailhead data for multiple usernames with limited concurrency.
 * Unbounded parallelism trips Trailhead's per-IP rate limit (HTTP 429),
 * so users are processed through a small worker pool.
 *
 * @param {string[]} usernames - Array of Trailhead usernames
 * @param {Object} [options]
 * @param {number} [options.concurrency] - Max users fetched at once
 * @param {Object} [options.queryOptions] - Banner options used to trim the query set (see computeQueryNeeds)
 * @returns {Promise<{resolved: Array, failed: Array}>}
 */
export async function fetchCompanyData(usernames, { concurrency = USER_CONCURRENCY, queryOptions = {} } = {}) {
  if (!usernames || usernames.length === 0) {
    return { resolved: [], failed: [] };
  }

  const needs = computeQueryNeeds(queryOptions);
  const results = new Array(usernames.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < usernames.length) {
      const index = nextIndex++;
      const username = usernames[index];
      try {
        results[index] = await fetchSingleUser(username, needs);
      } catch (error) {
        // fetchSingleUser handles its own errors; this is a safety net
        results[index] = { success: false, username, status: 'error', error: error?.message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, usernames.length) }, worker));

  const resolved = [];
  const failed = [];

  for (const result of results) {
    if (result.success) {
      resolved.push(result.data);
    } else {
      failed.push({ username: result.username, status: result.status || 'not_found' });
    }
  }

  return { resolved, failed };
}
