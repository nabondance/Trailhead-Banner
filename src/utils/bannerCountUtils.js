import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side total of generated banners (estimated), deduplicated per render with React cache.
 * Used for crawler-facing surfaces only (metadata, JSON-LD, llms.txt); the visible counter stays live client-side.
 * @returns {Promise<number|null>} null when the count can't be fetched
 */
export const getBannerCount = cache(async () => {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { count, error } = await supabase
      .from('banners')
      .select('id', { count: 'estimated', head: true })
      .eq('source_env', process.env.NEXT_PUBLIC_VERCEL_ENV || 'development');
    if (error) throw error;
    return count ?? null;
  } catch (error) {
    console.error('Error fetching banner count:', error);
    return null;
  }
});

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
