import { SERVER_ENV } from './envUtils';

// The snow globe is the 2026 Rewind
export const REWIND_YEAR = 2026;

/**
 * Whether new Rewind globes can be built. Production opens December of the
 * Rewind year and the January after; every other environment (local dev,
 * Vercel previews) is always open for testing. Server-only (SERVER_ENV).
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isRewindOpen(now = new Date()) {
  if (SERVER_ENV !== 'production') return true;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0 = January, 11 = December
  return (year === REWIND_YEAR && month === 11) || (year === REWIND_YEAR + 1 && month === 0);
}
