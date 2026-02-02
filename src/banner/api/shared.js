/**
 * Shared utilities for banner API endpoints
 * Common workflows, timing tracking, and error handling
 */

import GraphQLUtils from '../../utils/graphqlUtils';

/**
 * Fetch user data from Trailhead GraphQL APIs with caching
 *
 * @param {Array} queries - Array of GraphQL query configurations
 * @param {string} username - Trailhead username (for cache key)
 * @returns {Promise<{responseMap: Object, cacheSummary: Object, timingBreakdown: Object, totalTime: number}>}
 */
export async function fetchUserData(queries, username) {
  const startTime = Date.now();
  const result = await GraphQLUtils.performQueriesWithCache(queries, username);

  // Build response map for easy access by query name
  const responseMap = {};
  result.responses.forEach((response, index) => {
    responseMap[queries[index].name] = response;
  });

  return {
    responseMap,
    cacheSummary: result.cacheSummary,
    timingBreakdown: result.timingBreakdown,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Create a timing tracker for performance monitoring
 *
 * @returns {{start: Function, end: Function, add: Function, getAll: Function}}
 */
export function createTimingTracker() {
  const timings = {};

  return {
    /**
     * Start timing a phase
     * @param {string} key - Phase identifier
     */
    start(key) {
      timings[`${key}_start`] = Date.now();
    },

    /**
     * End timing a phase and calculate duration
     * @param {string} key - Phase identifier (will add _ms suffix automatically)
     */
    end(key) {
      const startKey = `${key}_start`;
      if (timings[startKey]) {
        timings[`${key}_ms`] = Date.now() - timings[startKey];
        delete timings[startKey];
      }
    },

    /**
     * Add a timing value directly
     * @param {string} key - Timing identifier
     * @param {number} value - Value in milliseconds
     */
    add(key, value) {
      timings[key] = value;
    },

    /**
     * Get all tracked timings
     * @returns {Object} Timing data
     */
    getAll() {
      return { ...timings };
    },
  };
}

/**
 * Handle errors consistently across banner endpoints
 * Returns appropriate HTTP status codes and user-friendly messages
 *
 * @param {Error} error - Error object
 * @param {Object} res - Express response object
 * @param {string} context - Context string for logging (e.g., 'standard banner', 'rewind')
 * @param {Object} metadata - Additional metadata for logging (e.g., {username, year})
 */
export function handleBannerError(error, res, context = 'banner', metadata = {}) {
  console.error(`Error generating ${context}:`, {
    message: error?.message || String(error),
    stack: error?.stack,
    ...metadata,
  });

  // Network connection errors
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Unable to connect to Trailhead services. Please try again later.',
    });
  }

  // HTTP response errors
  if (error?.response) {
    const status = error.response.status;
    console.error('Response data:', error.response?.data);
    console.error('Response status:', status);

    if (status === 404) {
      return res.status(404).json({
        error: 'User not found',
        message: `No Trailhead profile found for username${metadata.username ? `: ${metadata.username}` : ''}`,
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error: 'Rate limited',
        message: 'Too many requests. Please wait a moment and try again.',
      });
    }

    if (status >= 500) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Trailhead services are currently unavailable. Please try again later.',
      });
    }

    return res.status(500).json({
      error: 'External service error',
      message: `Failed to fetch data from Trailhead (Status: ${status})`,
    });
  }

  // Request errors (no response received)
  if (error?.request) {
    console.error('Request failed:', error.request);
    return res.status(503).json({
      error: 'Network error',
      message: 'Unable to connect to external services. Please check your connection and try again.',
    });
  }

  // Generic errors
  return res.status(500).json({
    error: 'Internal error',
    message: `An unexpected error occurred while generating ${context}.`,
  });
}
