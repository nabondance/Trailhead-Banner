import { fetchUserData } from '../banner/api/shared.js';
import { QUERY_MAP } from '../banner/api/queryBuilder.js';
import { fetchSfdxHardisBadges, getHighestSfdxHardisBadge } from './sfdxHardisBadgeUtils.js';
import { extractUsernameFromUrl } from './usernameValidation.js';

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
// Max team size for a company banner (chunked flow). Keep in sync with the form.
export const MAX_COMPANY_USERS = 500;
// The direct flow fetches everything inside one /api/banner/company call
// (60s limit), so it only suits small teams — CI and API callers.
export const MAX_DIRECT_USERS = 50;
// Usernames are slugs; anything longer is not a real Trailhead username
const MAX_USERNAME_LENGTH = 80;

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
 * The sfdx-hardis training badges come from a separate public JSON document,
 * needed for the badge icons or the CSV export.
 *
 * @param {Object} options - Banner options (generateCsv, counterOrder, displaySfdxHardisBadges)
 * @returns {{mvp: boolean, sfdxHardis: boolean}}
 */
export function computeQueryNeeds(options = {}) {
  const csv = !!options.generateCsv;
  const counters = Array.isArray(options.counterOrder) ? options.counterOrder : [];
  return {
    mvp: csv || counters.includes('mvp'),
    sfdxHardis: csv || options.displaySfdxHardisBadges !== false,
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
      optional: QUERY_MAP.GET_MVP_STATUS.optional,
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
async function fetchSingleUser(username, needs, deadline = Infinity) {
  const queries = buildCompanyQueries(username, needs);

  for (let attempt = 0; ; attempt++) {
    // Waiting out a cooldown (possibly set by another worker) or retrying past
    // the time budget would overrun the function limit: hand the user back
    if (attempt > 0 || rateLimitCooldownUntil > Date.now()) {
      if (rateLimitCooldownUntil > deadline || Date.now() > deadline) {
        return { success: false, username, status: 'deferred' };
      }
    }
    try {
      await waitForCooldown();
      return await fetchSingleUserOnce(queries, username, needs);
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

async function fetchSingleUserOnce(queries, username, needs) {
  // The badge read is fail-open (null on any error) and Redis-cached, so it
  // never fails the user and is cheap to repeat on rate-limit retries
  const [{ responseMap, failedQueries }, sfdxHardisBadgesData] = await Promise.all([
    fetchUserData(queries, username, { ttlSeconds: COMPANY_CACHE_TTL_SECONDS }),
    needs.sfdxHardis ? fetchSfdxHardisBadges(username) : Promise.resolve(null),
  ]);

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
      // The community API failed, so MVP status is unknown (not "not an MVP")
      mvpUnavailable: failedQueries.includes('GET_MVP_STATUS'),
      // aggregateCompanyData reads agentblazerData.learnerStatusLevels
      agentblazerData: rankData,
      // Highest verified sfdx-hardis training badge level (1-3), null when none
      sfdxHardisLevel: getHighestSfdxHardisBadge(sfdxHardisBadgesData)?.level ?? null,
    },
  };
}

/**
 * Clean a username list: turn profile URLs into usernames, keep non-empty
 * strings of a sane length, trimmed, and drop case-insensitive duplicates (Trailhead usernames are
 * case-insensitive, so "Jane" and "jane" are one person counted once).
 *
 * @param {Array} list
 * @returns {string[]} Unique usernames, first spelling kept
 */
export function normalizeUsernames(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const username = extractUsernameFromUrl(item);
    const key = username.toLowerCase();
    if (!username || username.length > MAX_USERNAME_LENGTH || seen.has(key)) continue;
    seen.add(key);
    result.push(username);
  }
  return result;
}

/**
 * Parse and deduplicate a username list from a textarea string.
 * Supports newline, comma, pipe and space separators.
 *
 * @param {string} raw - Raw textarea content
 * @returns {string[]} Cleaned, unique usernames
 */
export function parseUsernames(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return normalizeUsernames(raw.split(/[\n,| ]+/));
}

/**
 * Accept a username list as an array or a separator-delimited string.
 * @param {Array|string} input
 * @returns {string[]}
 */
export function parseUsernameInput(input) {
  return Array.isArray(input) ? normalizeUsernames(input) : parseUsernames(typeof input === 'string' ? input : '');
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
 * @param {number} [options.deadline] - Epoch ms after which no new user is started and
 *   rate-limit back-offs are not waited out; those users are returned in `deferred`
 * @returns {Promise<{resolved: Array, failed: Array, deferred: string[]}>}
 */
export async function fetchCompanyData(
  usernames,
  { concurrency = USER_CONCURRENCY, queryOptions = {}, deadline = Infinity } = {}
) {
  if (!usernames || usernames.length === 0) {
    return { resolved: [], failed: [], deferred: [] };
  }

  const needs = computeQueryNeeds(queryOptions);
  const results = new Array(usernames.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < usernames.length) {
      const index = nextIndex++;
      const username = usernames[index];
      if (Date.now() > deadline) {
        results[index] = { success: false, username, status: 'deferred' };
        continue;
      }
      try {
        results[index] = await fetchSingleUser(username, needs, deadline);
      } catch (error) {
        // fetchSingleUser handles its own errors; this is a safety net
        results[index] = { success: false, username, status: 'error', error: error?.message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, usernames.length) }, worker));

  const resolved = [];
  const failed = [];
  const deferred = [];

  for (const result of results) {
    if (result.success) {
      resolved.push(result.data);
    } else if (result.status === 'deferred') {
      deferred.push(result.username);
    } else {
      failed.push({ username: result.username, status: result.status || 'not_found' });
    }
  }

  return { resolved, failed, deferred };
}
