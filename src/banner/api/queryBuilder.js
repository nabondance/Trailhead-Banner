/**
 * GraphQL query builder for banner API
 * Centralizes query configuration and provides query construction utilities
 */

import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_TRAILHEAD_BADGES from '../../graphql/queries/getTrailheadBadges';
import GET_MVP_STATUS from '../../graphql/queries/getMvpStatus';
import GET_STAMPS from '../../graphql/queries/getStamps';
import GET_AGENTBLAZER_RANK from '../../graphql/queries/getAgentblazerRank';
import { calculateRequiredQueries } from '../../utils/queryDependencyCalculator';

/**
 * Query configuration map
 * Maps query names to their GraphQL query objects, endpoints, and variable builders
 */
export const QUERY_MAP = {
  GET_TRAILBLAZER_RANK: {
    query: GET_TRAILBLAZER_RANK,
    url: 'https://profile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      hasSlug: true,
      ...params,
    }),
  },
  GET_USER_CERTIFICATIONS: {
    query: GET_USER_CERTIFICATIONS,
    url: 'https://profile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      hasSlug: true,
      count: params.count || 100,
    }),
  },
  GET_TRAILHEAD_BADGES: {
    query: GET_TRAILHEAD_BADGES,
    url: 'https://profile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      hasSlug: true,
      count: params.count || 5,
      after: null,
      filter: params.filter || null,
    }),
  },
  GET_TRAILHEAD_BADGES_SUPERBADGE: {
    query: GET_TRAILHEAD_BADGES,
    url: 'https://profile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      hasSlug: true,
      count: params.count || 100,
      after: null,
      filter: 'SUPERBADGE',
    }),
  },
  GET_MVP_STATUS: {
    query: GET_MVP_STATUS,
    url: 'https://community.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      userSlug: username,
      queryMvp: true,
      ...params,
    }),
  },
  GET_STAMPS: {
    query: GET_STAMPS,
    url: 'https://mobile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      first: params.first || 10,
    }),
  },
  GET_AGENTBLAZER_RANK: {
    query: GET_AGENTBLAZER_RANK,
    url: 'https://profile.api.trailhead.com/graphql',
    buildVariables: (username, params) => ({
      slug: username,
      hasSlug: true,
      ...params,
    }),
  },
};

/**
 * Build standard banner queries based on user options
 * Uses dynamic query selection to only fetch necessary data
 *
 * @param {string} username - Trailhead username
 * @param {Object} options - Banner generation options
 * @returns {Array<{name: string, query: string, variables: Object, url: string}>} Array of GraphQL queries
 */
export function buildStandardQueries(username, options) {
  const requiredQueries = calculateRequiredQueries(options);

  return requiredQueries.map(({ name, params }) => {
    const config = QUERY_MAP[name];
    if (!config) {
      throw new Error(`Unknown query: ${name}`);
    }
    return {
      name,
      query: config.query,
      variables: config.buildVariables(username, params),
      url: config.url,
    };
  });
}

/**
 * Build rewind banner queries
 * Fixed query set for year-in-review functionality
 *
 * @param {string} username - Trailhead username
 * @returns {Array<{name: string, query: string, variables: Object, url: string}>} Array of GraphQL queries
 */
export function buildRewindQueries(username) {
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
      name: 'GET_STAMPS',
      query: QUERY_MAP.GET_STAMPS.query,
      variables: QUERY_MAP.GET_STAMPS.buildVariables(username, { first: 50 }),
      url: QUERY_MAP.GET_STAMPS.url,
    },
    {
      name: 'GET_AGENTBLAZER_RANK',
      query: QUERY_MAP.GET_AGENTBLAZER_RANK.query,
      variables: QUERY_MAP.GET_AGENTBLAZER_RANK.buildVariables(username, {}),
      url: QUERY_MAP.GET_AGENTBLAZER_RANK.url,
    },
  ];
}
