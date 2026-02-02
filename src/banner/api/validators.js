/**
 * Username validation utilities for banner API
 * Centralizes validation logic for reuse across banner endpoints
 */

// Re-export existing format validation functions
export { extractUsernameFromUrl, validateUsernameFormat } from '../../utils/usernameValidation.js';

/**
 * Validate username with GraphQL API
 * Uses async imports to keep the API lightweight
 *
 * @param {string} username - Username to validate
 * @returns {Promise<{valid: boolean, state: string, message: string}>} Validation result
 */
export async function validateUsername(username) {
  const axios = (await import('axios')).default;
  const GET_TRAILBLAZER_RANK = (await import('../../graphql/queries/getTrailblazerRank')).default;
  const { validateUsernameWithGraphQL } = await import('../../utils/usernameValidation.js');

  return validateUsernameWithGraphQL(username, axios, GET_TRAILBLAZER_RANK);
}

/**
 * Validate request content length
 *
 * @param {number} contentLength - Content-Length header value in bytes
 * @param {number} maxBytes - Maximum allowed size (default: 5MB)
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateContentLength(contentLength, maxBytes = 5 * 1024 * 1024) {
  if (contentLength > maxBytes) {
    return {
      valid: false,
      error: 'Request entity too large. Maximum payload size is 5MB',
    };
  }
  return { valid: true };
}
