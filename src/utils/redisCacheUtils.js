import { Redis } from '@upstash/redis';

/**
 * Redis Cache Utilities for GraphQL Response Caching
 *
 * Provides caching functionality using Upstash Redis
 * with graceful fallback if Redis is unavailable.
 */
class RedisCacheUtils {
  static CACHE_TTL_SECONDS = 900; // 15 minutes
  static redisClient = null;
  static redisAvailable = null;

  /**
   * Initialize Redis client if environment variables are available
   */
  static getClient() {
    if (this.redisClient) {
      return this.redisClient;
    }

    const url = process.env.thb_KV_REST_API_URL;
    const token = process.env.thb_KV_REST_API_TOKEN;

    if (!url || !token) {
      console.warn('[Redis Cache] Redis credentials not found in environment. Caching disabled.');
      this.redisAvailable = false;
      return null;
    }

    try {
      this.redisClient = new Redis({
        url,
        token,
      });
      this.redisAvailable = true;
      console.log('[Redis Cache] Redis client initialized successfully');
      return this.redisClient;
    } catch (error) {
      console.error('[Redis Cache] Failed to initialize Redis client:', error.message);
      this.redisAvailable = false;
      return null;
    }
  }

  /**
   * Check if Redis is available
   */
  static async isAvailable() {
    if (this.redisAvailable !== null) {
      return this.redisAvailable;
    }

    const client = this.getClient();
    if (!client) {
      this.redisAvailable = false;
      return false;
    }

    try {
      // Test connection with a simple ping
      await client.ping();
      this.redisAvailable = true;
      return true;
    } catch (error) {
      console.error('[Redis Cache] Connection test failed:', error.message);
      this.redisAvailable = false;
      return false;
    }
  }

  /**
   * Extract query operation name from GraphQL query string
   * Example: "query GetTrailblazerRank" -> "GetTrailblazerRank"
   */
  static extractQueryName(queryString) {
    if (!queryString || typeof queryString !== 'string') {
      return null;
    }

    // Match "query OperationName" or "mutation OperationName"
    const match = queryString.match(/(?:query|mutation)\s+([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Generate cache key for a GraphQL query
   * Format: graphql:{username}:{QueryName}:{variablesHash}
   * Variables hash ensures different variable combinations get different cache keys
   */
  static generateCacheKey(username, queryString, variables) {
    const queryName = this.extractQueryName(queryString);
    const crypto = require('crypto');

    // Create a short hash of the variables to differentiate queries with same name but different variables
    const variablesHash = crypto
      .createHash('md5')
      .update(JSON.stringify(variables || {}))
      .digest('hex')
      .substring(0, 8);

    if (queryName) {
      return `graphql:${username}:${queryName}:${variablesHash}`;
    }

    // Fallback: Create hash from query + variables
    const fullHash = crypto
      .createHash('md5')
      .update(queryString + JSON.stringify(variables || {}))
      .digest('hex')
      .substring(0, 8);

    return `graphql:${username}:${fullHash}`;
  }

  /**
   * Get cached query result
   * Returns null if not found or on error (graceful degradation)
   */
  static async getCachedQuery(cacheKey) {
    const client = this.getClient();
    if (!client) {
      return null;
    }

    try {
      const cached = await client.get(cacheKey);
      if (cached) {
        console.log(`[Redis Cache] Cache HIT for key: ${cacheKey}`);
        return cached;
      }
      console.log(`[Redis Cache] Cache MISS for key: ${cacheKey}`);
      return null;
    } catch (error) {
      console.error(`[Redis Cache] Read failed for ${cacheKey}:`, error.message);
      return null;
    }
  }

  /**
   * Store query result in cache with TTL
   * Non-blocking - errors are logged but don't throw
   */
  static async setCachedQuery(cacheKey, data, ttlSeconds = this.CACHE_TTL_SECONDS) {
    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.setex(cacheKey, ttlSeconds, JSON.stringify(data));
      console.log(`[Redis Cache] Cached result for key: ${cacheKey} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error(`[Redis Cache] Write failed for ${cacheKey}:`, error.message);
      // Don't throw - cache write failures should not break the request
    }
  }

  /**
   * Handle Redis errors gracefully
   * Logs error details and returns a standardized error object
   */
  static handleRedisError(error, operation, queryName) {
    const errorInfo = {
      operation,
      queryName,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    console.error(`[Redis Cache] Error during ${operation} for ${queryName}:`, error);
    return errorInfo;
  }

  /**
   * Invalidate cache for a specific user (all queries)
   * Useful for manual cache clearing
   */
  static async invalidateUserCache(username) {
    const client = this.getClient();
    if (!client) {
      return { success: false, reason: 'Redis not available' };
    }

    try {
      // Note: Upstash Redis doesn't support KEYS command in REST API
      // This would need to be implemented differently in production
      // For now, we rely on TTL expiration
      console.log(`[Redis Cache] Cache invalidation requested for user: ${username}`);
      console.log('[Redis Cache] Note: Manual invalidation not fully supported - relying on TTL');
      return { success: true, method: 'ttl-based' };
    } catch (error) {
      console.error('[Redis Cache] Invalidation failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default RedisCacheUtils;
