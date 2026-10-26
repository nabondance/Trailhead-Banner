/**
 * Shared access to the `generation_count` database function, used by both the
 * server (bannerCountUtils.js, service role client) and the browser (GenerationCount, anon client).
 * Client-safe: takes the Supabase client as a parameter and imports no server-only module.
 */

import { APP_ENV } from './envUtils';

// Worth retrying: network failure (status 0), timeout, rate limit, server error.
// Other errors (permission denied, missing function, bad params) won't fix themselves.
const isTransientStatus = (status) => status === 0 || status === 408 || status === 429 || status >= 500;

/**
 * Fetches the number of generations recorded in a table for the current environment.
 * Never throws: failures come back as `error`, with `retryable` telling whether trying again could help.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table - 'banners', 'rewinds' or 'company_banners'
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ count: number|null, error: object|null, status: number, retryable: boolean }>}
 */
export const fetchGenerationCount = async (client, table, { signal } = {}) => {
  let query = client.rpc('generation_count', { p_table: table, p_env: APP_ENV });
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;

  if (error) return { count: null, error, status, retryable: isTransientStatus(status) };
  // A malformed success response may be a transient glitch, so it's retryable
  if (!Number.isFinite(data)) {
    return { count: null, error: { message: `Unexpected ${table} count: ${data}` }, status, retryable: true };
  }
  return { count: data, error: null, status, retryable: false };
};
