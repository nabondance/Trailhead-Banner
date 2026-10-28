import { cache } from 'react';
import { supabase } from './supabaseUtils';
import { fetchGenerationCount } from './generationCountUtils';

const COUNT_TIMEOUT_MS = 5000;

/**
 * Server-side generation total for a table, deduplicated per render with React cache.
 * Used for crawler-facing surfaces (metadata, JSON-LD, llms.txt) and as the deploy-time
 * fallback of the visible GenerationCount counter.
 * @param {string} table - 'banners', 'rewinds' or 'company_banners'
 * @returns {Promise<number|null>} null when the count can't be fetched
 */
export const getGenerationCount = cache(async (table) => {
  if (!supabase) return null;
  try {
    // Called during static builds: a hung request must not stall the deploy
    const { count, error } = await fetchGenerationCount(supabase, table, {
      signal: AbortSignal.timeout(COUNT_TIMEOUT_MS),
    });
    if (error) console.error(`Error fetching ${table} count:`, error);
    return count;
  } catch (error) {
    console.error(`Error fetching ${table} count:`, error);
    return null;
  }
});

/**
 * Server-side total of generated banners.
 * @returns {Promise<number|null>} null when the count can't be fetched
 */
export const getBannerCount = () => getGenerationCount('banners');

/**
 * Rounds down to a stable, citable figure ("43,000+") so it doesn't churn on every regeneration.
 * @param {number|null} count
 * @returns {string|null}
 */
export const formatBannerCount = (count) => {
  if (!count) return null;
  if (count < 1000) return `${count}`;
  return `${(Math.floor(count / 1000) * 1000).toLocaleString('en-US')}+`;
};
