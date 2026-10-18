import net from 'net';
import { Ratelimit } from '@upstash/ratelimit';
import RedisCacheUtils from './redisCacheUtils.js';

/**
 * Per-IP rate limiting for the API routes that call Trailhead.
 *
 * Trailhead rate-limits by IP, and all Vercel functions share a few outbound
 * IPs: one client looping on an endpoint could exhaust that budget for every
 * user. Limits are sized well above normal use (a full 500-user company
 * banner, retries included, fits in one window).
 *
 * Fails open: if Redis is missing or slow, requests are allowed.
 */

const LIMITS = {
  standard: { tokens: 30, window: '1 m' },
  rewind: { tokens: 30, window: '1 m' },
  validateUsername: { tokens: 60, window: '1 m' },
  // Counted per username, not per request (a fetch chunk holds up to 25, the
  // direct company flow up to 50). Room for a few full 500-user runs with
  // retries, and for colleagues sharing an office IP.
  companyFetchUsers: { tokens: 3000, window: '10 m' },
  company: { tokens: 30, window: '10 m' },
};

const limiters = new Map();

function getLimiter(name) {
  if (limiters.has(name)) return limiters.get(name);
  const redis = RedisCacheUtils.getClient();
  const config = LIMITS[name];
  const limiter =
    redis && config
      ? new Ratelimit({
          redis,
          // Fixed window: its reset time is exact, so Retry-After is true
          limiter: Ratelimit.fixedWindow(config.tokens, config.window),
          prefix: `thb:ratelimit:${process.env.VERCEL_ENV || 'development'}:${name}`,
          // Never let the limiter slow a request down much
          timeout: 1000,
          analytics: false,
        })
      : null;
  limiters.set(name, limiter);
  return limiter;
}

/**
 * Client IP. On Vercel, x-real-ip and x-forwarded-for are set by the platform
 * (client-sent values are overwritten), so they can be trusted there.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Rate-limit key for an IP. An IPv6 client usually owns a whole /64, so
 * limiting single addresses would let it rotate through endless fresh buckets.
 * @param {string} ip
 * @returns {string}
 */
export function getRateLimitKey(ip) {
  if (net.isIPv4(ip) || !net.isIPv6(ip)) return ip;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) return ip.slice(7); // IPv4-mapped
  const [head, tail = ''] = ip.split('%')[0].toLowerCase().split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const parts = ip.includes('::')
    ? [...headParts, ...new Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
    : headParts;
  return `${parts
    .slice(0, 4)
    .map((part) => parseInt(part || '0', 16).toString(16))
    .join(':')}::/64`;
}

/**
 * Consume tokens from a named limit for the request's IP.
 * @param {import('http').IncomingMessage} req
 * @param {keyof LIMITS} name
 * @param {number} [tokens=1]
 * @returns {Promise<{allowed: boolean, retryAfterSeconds: number}>}
 */
export async function checkRateLimit(req, name, tokens = 1) {
  const limiter = getLimiter(name);
  if (!limiter) return { allowed: true, retryAfterSeconds: 0 };
  try {
    const key = getRateLimitKey(getClientIp(req));
    const result = await limiter.limit(key, { rate: tokens });
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    if (!result.success) {
      console.warn(`[Rate Limit] ${name} blocked for ${key} (retry in ${retryAfterSeconds}s)`);
    }
    return { allowed: result.success, retryAfterSeconds };
  } catch (error) {
    console.error('[Rate Limit] Check failed, allowing request:', error?.message);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

function formatWait(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * Apply a named limit and send the 429 response when it is exceeded.
 * @returns {Promise<boolean>} true when the request may continue
 */
export async function enforceRateLimit(req, res, name, tokens = 1) {
  const { allowed, retryAfterSeconds } = await checkRateLimit(req, name, tokens);
  if (allowed) return true;
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'Rate limited',
    message: `Too many requests. Please wait ${formatWait(retryAfterSeconds)} and try again.`,
    rateLimited: true,
    retryAfterSeconds,
  });
  return false;
}
