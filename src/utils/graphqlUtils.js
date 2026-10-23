import axios from 'axios';
import RedisCacheUtils from './redisCacheUtils.js';

// Optional queries (the Trailblazer Community API, see queryBuilder) get a
// shorter timeout, and after a network/HTTP failure their endpoint is skipped
// for a minute, so a dead or hanging API doesn't slow down every banner.
// The skip state is per warm serverless instance.
const REQUIRED_QUERY_TIMEOUT_MS = 15000;
const OPTIONAL_QUERY_TIMEOUT_MS = 5000;
const OPTIONAL_OUTAGE_SKIP_MS = 60000;
const optionalOutageUntil = new Map(); // url -> epoch ms

// GraphQL error codes that mean "this user has no data here", not "the API is unavailable"
const USER_LEVEL_ERROR_CODES = new Set(['USER_NOT_FOUND', 'NOT_FOUND']);

/**
 * True when a GraphQL body carries errors and no usable data
 * (e.g. `{ errors: [{ message: 'Service unavailable' }], data: null }`).
 */
function isUnusableErrorBody(body) {
  if (!body?.errors?.length) return false;
  if (body.errors.every((e) => USER_LEVEL_ERROR_CODES.has(e?.extensions?.code))) return false;
  return !body.data || Object.values(body.data).every((value) => value == null);
}

class GraphQLUtils {
  static async performQueries(queries) {
    return await Promise.all(
      queries.map((query) =>
        axios.post(
          query.url,
          { query: query.query, variables: query.variables },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 15000, // 15 second timeout (reasonable for GraphQL)
          }
        )
      )
    );
  }

  /**
   * Perform GraphQL queries with Redis caching
   * Returns cached results when available, falls back to GraphQL API otherwise
   *
   * @param {Array} queries - Array of query objects with { name, query, variables, url, optional }.
   *   An `optional` query that fails (network/HTTP error including 429, non-JSON body, or a GraphQL
   *   error body without data) resolves to null instead of rejecting the whole batch, and its name
   *   is listed in `failedQueries`
   * @param {string} username - Username for cache key generation
   * @param {Object} [options]
   * @param {number} [options.ttlSeconds] - Cache TTL override (defaults to RedisCacheUtils.CACHE_TTL_SECONDS)
   * @returns {Object} { responses, failedQueries, timingBreakdown, cacheSummary }
   */
  static async performQueriesWithCache(queries, username, { ttlSeconds } = {}) {
    const timingBreakdown = [];
    const cacheErrors = [];
    const failedQueries = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // Check if Redis is available
    const redisAvailable = await RedisCacheUtils.isAvailable();

    // Process each query with caching
    const queryPromises = queries.map(async (query, index) => {
      const queryStart = new Date().getTime();
      const queryName = RedisCacheUtils.extractQueryName(query.query) || `Query_${index}`;

      let result = null;
      let cacheHit = false;
      let source = 'graphql';

      // Try cache first if Redis is available
      if (redisAvailable) {
        const cacheKey = RedisCacheUtils.generateCacheKey(username, query.query, query.variables);

        try {
          const cached = await RedisCacheUtils.getCachedQuery(cacheKey);
          if (cached) {
            result = cached;
            cacheHit = true;
            source = 'cache';
            cacheHits++;
          }
        } catch (error) {
          cacheErrors.push(RedisCacheUtils.handleRedisError(error, 'read', queryName));
        }
      }

      const label = query.name || queryName;

      // Optional endpoint failed recently: skip it instead of waiting on it again
      if (!result && query.optional && (optionalOutageUntil.get(query.url) || 0) > Date.now()) {
        failedQueries.push(label);
        source = 'skipped';
      } else if (!result) {
        // Fetch from GraphQL if not cached
        try {
          const graphqlResponse = await axios.post(
            query.url,
            { query: query.query, variables: query.variables },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: query.optional ? OPTIONAL_QUERY_TIMEOUT_MS : REQUIRED_QUERY_TIMEOUT_MS,
            }
          );

          if (query.optional) {
            // A non-GraphQL body (e.g. an HTML page after a redirect) means the API is gone
            if (typeof graphqlResponse.data !== 'object' || graphqlResponse.data === null) {
              throw new Error(`Unexpected non-JSON response from ${query.url}`);
            }
            // A 200 with only errors (rate limit, service unavailable...): no data, but
            // possibly user-specific, so don't skip the endpoint for everyone
            if (isUnusableErrorBody(graphqlResponse.data)) {
              const bodyError = new Error(graphqlResponse.data.errors[0]?.message || 'GraphQL error');
              bodyError.isGraphQLErrorBody = true;
              throw bodyError;
            }
          }

          result = graphqlResponse;
          cacheMisses++;

          // Store in cache asynchronously (non-blocking)
          // Only cache the serializable parts (avoid circular references)
          // Skip responses with GraphQL errors (e.g. rate limits) so a transient
          // failure isn't served from cache for the whole TTL. Skip private
          // profiles too: users make their profile public and regenerate right
          // away, and a cached PrivateProfile would keep them "private" until expiry
          const isPrivateProfile = graphqlResponse.data?.data?.profile?.__typename === 'PrivateProfile';
          if (redisAvailable && !graphqlResponse.data?.errors?.length && !isPrivateProfile) {
            const cacheKey = RedisCacheUtils.generateCacheKey(username, query.query, query.variables);
            const serializableResponse = {
              data: graphqlResponse.data,
              status: graphqlResponse.status,
              statusText: graphqlResponse.statusText,
              headers: graphqlResponse.headers,
            };
            RedisCacheUtils.setCachedQuery(cacheKey, serializableResponse, ttlSeconds).catch((error) => {
              cacheErrors.push(RedisCacheUtils.handleRedisError(error, 'write', queryName));
            });
          }
        } catch (error) {
          // Required query errors are handled by the caller
          if (!query.optional) throw error;
          console.warn(
            `[GraphQL] Optional query ${label} failed, continuing without it:`,
            error?.response?.status || error?.code || error?.message
          );
          if (!error.isGraphQLErrorBody) {
            optionalOutageUntil.set(query.url, Date.now() + OPTIONAL_OUTAGE_SKIP_MS);
          }
          failedQueries.push(label);
          source = 'error';
        }
      }

      const queryTime = new Date().getTime() - queryStart;

      // Track timing for this query
      timingBreakdown.push({
        queryName,
        url: query.url,
        cache_hit: cacheHit,
        time_ms: queryTime,
        source,
        timestamp: new Date().toISOString(),
      });

      return result;
    });

    // Execute all queries in parallel
    const responses = await Promise.all(queryPromises);

    // Calculate cache summary with actual timing data
    const totalQueries = queries.length;
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;

    // Calculate actual average times from this request
    const hitTimes = timingBreakdown.filter((t) => t.cache_hit).map((t) => t.time_ms);
    // Failed/skipped optional queries are neither hits nor misses
    const missTimes = timingBreakdown.filter((t) => t.source === 'graphql').map((t) => t.time_ms);

    const avgCacheHitTime = hitTimes.length > 0 ? hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length : 0;
    const avgCacheMissTime = missTimes.length > 0 ? missTimes.reduce((a, b) => a + b, 0) / missTimes.length : 0;

    const cacheSummary = {
      total_queries: totalQueries,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
      cache_hit_rate: parseFloat(cacheHitRate.toFixed(3)),
      avg_cache_hit_time_ms: Math.round(avgCacheHitTime),
      avg_cache_miss_time_ms: Math.round(avgCacheMissTime),
      redis_available: redisAvailable,
      failed_queries: failedQueries.length,
      errors: cacheErrors,
    };

    // Log cache performance
    if (redisAvailable) {
      const perfSummary = cacheHits > 0 ? `Avg Hit: ${cacheSummary.avg_cache_hit_time_ms}ms` : '';
      const missInfo = cacheMisses > 0 ? `Avg Miss: ${cacheSummary.avg_cache_miss_time_ms}ms` : '';
      const timingInfo = [perfSummary, missInfo].filter(Boolean).join(' | ');

      console.log(
        `[Redis Cache] User: ${username} | ` +
          `Queries: ${totalQueries} | Hits: ${cacheHits} | Misses: ${cacheMisses} | ` +
          `Hit Rate: ${(cacheHitRate * 100).toFixed(1)}%` +
          (timingInfo ? ` | ${timingInfo}` : '')
      );
    }

    return {
      responses,
      failedQueries,
      timingBreakdown,
      cacheSummary,
    };
  }
}

export default GraphQLUtils;
