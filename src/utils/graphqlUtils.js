import axios from 'axios';
import RedisCacheUtils from './redisCacheUtils.js';

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
   * @param {Array} queries - Array of query objects with { query, variables, url }
   * @param {string} username - Username for cache key generation
   * @returns {Object} { responses, timingBreakdown, cacheSummary }
   */
  static async performQueriesWithCache(queries, username) {
    const timingBreakdown = [];
    const cacheErrors = [];
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

      // Fetch from GraphQL if not cached
      if (!result) {
        try {
          const graphqlResponse = await axios.post(
            query.url,
            { query: query.query, variables: query.variables },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 15000,
            }
          );

          result = graphqlResponse;
          cacheMisses++;

          // Store in cache asynchronously (non-blocking)
          // Only cache the serializable parts (avoid circular references)
          if (redisAvailable) {
            const cacheKey = RedisCacheUtils.generateCacheKey(username, query.query, query.variables);
            const serializableResponse = {
              data: graphqlResponse.data,
              status: graphqlResponse.status,
              statusText: graphqlResponse.statusText,
              headers: graphqlResponse.headers,
            };
            RedisCacheUtils.setCachedQuery(cacheKey, serializableResponse).catch((error) => {
              cacheErrors.push(RedisCacheUtils.handleRedisError(error, 'write', queryName));
            });
          }
        } catch (error) {
          // Re-throw GraphQL errors - these should be handled by caller
          throw error;
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
    const missTimes = timingBreakdown.filter((t) => !t.cache_hit).map((t) => t.time_ms);

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
      timingBreakdown,
      cacheSummary,
    };
  }
}

export default GraphQLUtils;
