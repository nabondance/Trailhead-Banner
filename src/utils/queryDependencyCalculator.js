/**
 * GraphQL Query Dependency Calculator for Banner Generation
 *
 * This module determines which GraphQL queries need to be executed based on
 * the user's selected options. This optimizes performance by only fetching
 * data that will actually be used in the banner.
 */

/**
 * Query dependency map for banner generation
 *
 * Each query defines:
 * - requiredWhen: Array of option keys that require this query (OR logic)
 * - alwaysRequired: Boolean to always fetch regardless of options
 * - params: Query parameters to pass when executing
 *
 * Adding new options:
 * 1. Add option to existing query's requiredWhen array, OR
 * 2. Add new query with its dependencies
 */
const QUERY_DEPENDENCIES = {
  GET_TRAILBLAZER_RANK: {
    // Fetch if user wants to display any rank-related data
    requiredWhen: [
      'displayBadgeCount',
      'displayTrailCount',
      'displayPointCount',
      'displayRankLogo',
      'displayAgentblazerRank'
    ],
    params: {}
  },

  GET_USER_CERTIFICATIONS: {
    // Fetch if user wants to display certifications in any form
    requiredWhen: [
      'displayCertificationCount',
      'displaySalesforceCertifications',
      'displayAccreditedProfessionalCertifications',
      'displayLastXCertifications'
    ],
    params: { count: 100 }
  },

  GET_TRAILHEAD_BADGES: {
    // Fetch general badges (non-superbadge)
    requiredWhen: ['displayBadgeCount'],
    params: { count: 5, filter: null }
  },

  GET_TRAILHEAD_BADGES_SUPERBADGE: {
    // Fetch superbadges specifically
    requiredWhen: [
      'displaySuperbadgeCount',
      'displaySuperbadges',
      'displayLastXSuperbadges'
    ],
    params: { count: 100, filter: 'SUPERBADGE' }
  },

  GET_MVP_STATUS: {
    // Always required - MVP status determines if ribbon is shown
    alwaysRequired: true,
    params: {}
  },

  GET_STAMPS: {
    // Fetch event stamps
    requiredWhen: ['displayStampCount'],
    params: { first: 10 }
  }
};

/**
 * Calculate which queries need to be executed based on user options
 *
 * @param {Object} options - User options from BannerForm
 * @param {boolean} options.displayBadgeCount - Show badge count
 * @param {boolean} options.displaySuperbadgeCount - Show superbadge count
 * @param {boolean} options.displayCertificationCount - Show certification count
 * @param {boolean} options.displayTrailCount - Show trail count
 * @param {boolean} options.displayPointCount - Show point count
 * @param {boolean} options.displayStampCount - Show stamp count
 * @param {boolean} options.displayRankLogo - Show rank logo
 * @param {boolean} options.displaySuperbadges - Show superbadge details
 * @param {boolean} options.displayAgentblazerRank - Show Agentblazer rank
 * @param {boolean} options.displaySalesforceCertifications - Show Salesforce certs
 * @param {boolean} options.displayAccreditedProfessionalCertifications - Show AP certs
 * @param {boolean} options.displayLastXCertifications - Limit certification display
 * @param {boolean} options.displayLastXSuperbadges - Limit superbadge display
 *
 * @returns {Array<{name: string, params: Object}>} Array of queries to execute
 *
 * @example
 * // User only wants badges and points, no certifications
 * calculateRequiredQueries({
 *   displayBadgeCount: true,
 *   displayPointCount: true,
 *   displayCertificationCount: false
 * });
 * // Returns: [
 * //   { name: 'GET_TRAILBLAZER_RANK', params: {} },
 * //   { name: 'GET_TRAILHEAD_BADGES', params: { count: 5, filter: null } },
 * //   { name: 'GET_MVP_STATUS', params: {} }
 * // ]
 *
 * @example
 * // No options provided - fetch everything (safe default)
 * calculateRequiredQueries();
 * // Returns all queries
 */
function calculateRequiredQueries(options) {
  // Safety: if no options provided, fetch everything
  if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
    return getAllQueries();
  }

  const requiredQueries = [];

  for (const [queryName, config] of Object.entries(QUERY_DEPENDENCIES)) {
    if (isQueryRequired(config, options)) {
      requiredQueries.push({
        name: queryName,
        params: config.params || {}
      });
    }
  }

  return requiredQueries;
}

/**
 * Check if a query should be executed based on its configuration
 *
 * A query is required if:
 * - It's marked as alwaysRequired (e.g., MVP status), OR
 * - At least ONE of its dependent options is set to true (OR logic)
 *
 * @param {Object} config - Query configuration from QUERY_DEPENDENCIES
 * @param {Object} options - User options
 * @returns {boolean} True if query should be executed
 */
function isQueryRequired(config, options) {
  // Always fetch if marked as required (e.g., MVP for ribbon)
  if (config.alwaysRequired === true) {
    return true;
  }

  // Check if ANY dependent option is enabled (OR logic)
  if (config.requiredWhen && Array.isArray(config.requiredWhen)) {
    return config.requiredWhen.some(optionKey => options[optionKey] === true);
  }

  // If no dependencies defined, don't fetch
  return false;
}

/**
 * Get all queries with their parameters
 * Used as fallback when options are not provided
 *
 * @returns {Array<{name: string, params: Object}>} All available queries
 */
function getAllQueries() {
  return Object.entries(QUERY_DEPENDENCIES).map(([name, config]) => ({
    name,
    params: config.params || {}
  }));
}

/**
 * Get the dependency map (useful for debugging/testing)
 *
 * @returns {Object} The QUERY_DEPENDENCIES map
 */
function getQueryDependencies() {
  return QUERY_DEPENDENCIES;
}

export {
  calculateRequiredQueries,
  getQueryDependencies,
  QUERY_DEPENDENCIES
};
