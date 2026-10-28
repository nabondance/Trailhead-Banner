/**
 * Deployment environment ('production', 'preview' or 'development'), used to scope Supabase reads
 * (announcements, generation counts) to the current environment's rows.
 * Client-safe: NEXT_PUBLIC_ vars are inlined at build time, so server and browser get the same value.
 */
export const APP_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV || 'development';

/**
 * Deployment environment from the server-only VERCEL_ENV: tags analytics rows and rate-limit keys,
 * and gates production-only behavior (robots.txt). Always 'development' in the browser, so use APP_ENV there.
 */
export const SERVER_ENV = process.env.VERCEL_ENV || 'development';
